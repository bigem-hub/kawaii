package com.kawaiilife.app.core.network

import android.util.Log
import com.kawaiilife.app.BuildConfig
import com.kawaiilife.app.core.auth.TokenStore
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject
import java.net.URI
import javax.inject.Inject
import javax.inject.Singleton

data class SocketEvent(val name: String, val data: JSONObject?)

@Singleton
class SocketManager @Inject constructor(
    private val tokenStore: TokenStore
) {
    private var socket: Socket? = null

    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<SocketEvent> = _events.asSharedFlow()

    private val _connected = MutableSharedFlow<Boolean>(replay = 1, extraBufferCapacity = 1)
    val connected: SharedFlow<Boolean> = _connected.asSharedFlow()

    fun connect() {
        val token = tokenStore.getToken() ?: return
        if (socket?.connected() == true) return

        try {
            val opts = IO.Options().apply {
                auth = mapOf("token" to token)
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionDelay = 1000L
                reconnectionAttempts = Int.MAX_VALUE
            }

            socket = IO.socket(URI.create(BuildConfig.WS_URL), opts).apply {
                on(Socket.EVENT_CONNECT) {
                    Log.d("SocketManager", "Connected")
                    _connected.tryEmit(true)
                }
                on(Socket.EVENT_DISCONNECT) {
                    Log.d("SocketManager", "Disconnected")
                    _connected.tryEmit(false)
                }
                on(Socket.EVENT_CONNECT_ERROR) { args ->
                    Log.e("SocketManager", "Connection error: ${args.firstOrNull()}")
                }

                // Chat events
                onEvent("chat:message")
                onEvent("chat:typing")
                onEvent("chat:reaction")

                // Watch party events
                onEvent("watch:play")
                onEvent("watch:pause")
                onEvent("watch:seek")
                onEvent("watch:chat")
                onEvent("media:update")
                onEvent("room:closed")
                onEvent("member:left")

                // Presence & notifications
                onEvent("presence")
                onEvent("notification")

                connect()
            }
        } catch (e: Exception) {
            Log.e("SocketManager", "Failed to connect socket", e)
        }
    }

    private fun Socket.onEvent(eventName: String) {
        on(eventName) { args ->
            val data = args.firstOrNull() as? JSONObject
            _events.tryEmit(SocketEvent(eventName, data))
        }
    }

    fun emit(event: String, data: JSONObject? = null) {
        if (data != null) {
            socket?.emit(event, data)
        } else {
            socket?.emit(event)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
        _connected.tryEmit(false)
    }

    fun isConnected(): Boolean = socket?.connected() == true
}
