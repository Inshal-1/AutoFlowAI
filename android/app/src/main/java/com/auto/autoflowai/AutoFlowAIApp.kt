package com.auto.autoflow

import android.app.Application
import com.auto.autoflow.data.SettingsStore

class AutoFlowApp : Application() {
    lateinit var settingsStore: SettingsStore
        private set

    override fun onCreate() {
        super.onCreate()
        settingsStore = SettingsStore(this)
    }
}
