package com.auto.autoflow.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

object SettingsKeys {
    val API_KEY = stringPreferencesKey("api_key")
    val SERVER_URL = stringPreferencesKey("server_url")
    val DEVICE_NAME = stringPreferencesKey("device_name")
    val AUTO_CONNECT = booleanPreferencesKey("auto_connect")
    val HAS_ONBOARDED = booleanPreferencesKey("has_onboarded")
    val CV_INTEGRATION_ENABLED = booleanPreferencesKey("cv_integration_enabled")
}

class SettingsStore(private val context: Context) {

    val apiKey: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.API_KEY] ?: ""
    }

    val serverUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.SERVER_URL] ?: "wss://tpa.rpaby.pw"
    }

    val deviceName: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.DEVICE_NAME] ?: android.os.Build.MODEL
    }

    val autoConnect: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.AUTO_CONNECT] ?: false
    }

    suspend fun setApiKey(value: String) {
        context.dataStore.edit { it[SettingsKeys.API_KEY] = value }
    }

    suspend fun setServerUrl(value: String) {
        context.dataStore.edit { it[SettingsKeys.SERVER_URL] = value }
    }

    suspend fun setDeviceName(value: String) {
        context.dataStore.edit { it[SettingsKeys.DEVICE_NAME] = value }
    }

    suspend fun setAutoConnect(value: Boolean) {
        context.dataStore.edit { it[SettingsKeys.AUTO_CONNECT] = value }
    }

    val hasOnboarded: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.HAS_ONBOARDED] ?: false
    }

    suspend fun setHasOnboarded(value: Boolean) {
        context.dataStore.edit { it[SettingsKeys.HAS_ONBOARDED] = value }
    }

    val cvIntegrationEnabled: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.CV_INTEGRATION_ENABLED] ?: false
    }

    suspend fun setCvIntegrationEnabled(value: Boolean) {
        context.dataStore.edit { it[SettingsKeys.CV_INTEGRATION_ENABLED] = value }
    }
}
