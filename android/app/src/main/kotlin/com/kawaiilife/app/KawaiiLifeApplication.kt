package com.kawaiilife.app

import android.app.Application
import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import androidx.work.WorkManager
import com.kawaiilife.app.core.network.SocketManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "kawaiilife_prefs")

@HiltAndroidApp
class KawaiiLifeApplication : Application() {

    @Inject
    lateinit var socketManager: SocketManager

    override fun onCreate() {
        super.onCreate()
    }
}