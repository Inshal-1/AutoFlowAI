package com.auto.autoflow.connection

import android.util.Base64
import android.util.Log
import com.auto.autoflow.accessibility.AutoFlowAccessibilityService
import com.auto.autoflow.accessibility.GestureExecutor
import com.auto.autoflow.accessibility.ScreenTreeBuilder
import com.auto.autoflow.capture.ScreenCaptureManager
import com.auto.autoflow.model.AgentStep
import com.auto.autoflow.model.GoalStatus
import com.auto.autoflow.model.PongMessage
import com.auto.autoflow.model.ResultResponse
import com.auto.autoflow.model.ScreenResponse
import com.auto.autoflow.model.ServerMessage
import kotlinx.coroutines.flow.MutableStateFlow

class CommandRouter(
    private val webSocket: ReliableWebSocket,
    private val captureManager: ScreenCaptureManager?
) {
    companion object {
        private const val TAG = "CommandRouter"
    }

    val currentGoalStatus = MutableStateFlow(GoalStatus.Idle)
    val currentSteps = MutableStateFlow<List<AgentStep>>(emptyList())
    val currentGoal = MutableStateFlow("")
    val currentSessionId = MutableStateFlow<String?>(null)

    private var gestureExecutor: GestureExecutor? = null

    fun updateGestureExecutor() {
        val svc = AutoFlowAccessibilityService.instance
        gestureExecutor = if (svc != null) GestureExecutor(svc) else null
    }

    suspend fun handleMessage(msg: ServerMessage) {
        Log.d(TAG, "Handling: ${msg.type}")

        when (msg.type) {
            "get_screen" -> handleGetScreen(msg.requestId!!)
            "ping" -> webSocket.sendTyped(PongMessage())

            "tap", "type", "enter", "back", "home", "notifications",
            "longpress", "swipe", "launch", "clear", "clipboard_set",
            "clipboard_get", "paste", "open_url", "switch_app",
            "keyevent", "open_settings", "wait", "intent" -> handleAction(msg)

            "goal_started" -> {
                currentSessionId.value = msg.sessionId
                currentGoal.value = msg.goal ?: ""
                currentGoalStatus.value = GoalStatus.Running
                currentSteps.value = emptyList()
                Log.i(TAG, "Goal started: ${msg.goal}")
            }
            "step" -> {
                val step = AgentStep(
                    step = msg.step ?: 0,
                    action = msg.action?.toString() ?: "",
                    reasoning = msg.reasoning ?: ""
                )
                currentSteps.value = currentSteps.value + step
                Log.d(TAG, "Step ${step.step}: ${step.reasoning}")
            }
            "goal_completed" -> {
                currentGoalStatus.value = if (msg.success == true) GoalStatus.Completed else GoalStatus.Failed
                Log.i(TAG, "Goal completed: success=${msg.success}, steps=${msg.stepsUsed}")
            }
            "goal_failed" -> {
                currentGoalStatus.value = GoalStatus.Failed
                Log.i(TAG, "Goal failed: ${msg.message}")
            }

            else -> Log.w(TAG, "Unknown message type: ${msg.type}")
        }
    }

    private fun handleGetScreen(requestId: String) {
        updateGestureExecutor()
        val svc = AutoFlowAccessibilityService.instance
        val elements = svc?.getScreenTree() ?: emptyList()
        val packageName = try {
            svc?.rootInActiveWindow?.packageName?.toString()
        } catch (_: Exception) { null }

        var screenshot: String? = null
        if (elements.isEmpty()) {
            val bytes = captureManager?.capture()
            if (bytes != null) {
                screenshot = Base64.encodeToString(bytes, Base64.NO_WRAP)
            }
        }

        val screenHash = if (elements.isNotEmpty()) {
            ScreenTreeBuilder.computeScreenHash(elements)
        } else null

        val response = ScreenResponse(
            requestId = requestId,
            elements = elements,
            screenHash = screenHash,
            screenshot = screenshot,
            packageName = packageName
        )
        webSocket.sendTyped(response)
    }

    private suspend fun handleAction(msg: ServerMessage) {
        updateGestureExecutor()
        val executor = gestureExecutor
        if (executor == null) {
            webSocket.sendTyped(
                ResultResponse(
                    requestId = msg.requestId!!,
                    success = false,
                    error = "Accessibility service not running"
                )
            )
            return
        }

        val result = executor.execute(msg)
        webSocket.sendTyped(
            ResultResponse(
                requestId = msg.requestId!!,
                success = result.success,
                error = result.error,
                data = result.data
            )
        )
    }

    fun reset() {
        currentGoalStatus.value = GoalStatus.Idle
        currentSteps.value = emptyList()
        currentGoal.value = ""
        currentSessionId.value = null
    }
}
