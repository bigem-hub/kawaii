package com.kawaiilife.app.core.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class KawaiiLifeFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("KawaiiLifeFMS", "New token: $token")
        // TODO: Send token to server
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d("KawaiiLifeFMS", "From: ${message.from}")
        // TODO: Handle notification
    }
}
