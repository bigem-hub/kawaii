package com.kawaiilife.app.feature.watch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.core.network.SocketManager
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

@HiltViewModel
class WatchViewModel @Inject constructor(
    private val api: ApiService,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _rooms = MutableStateFlow<List<WatchRoomDto>>(emptyList())
    val rooms: StateFlow<List<WatchRoomDto>> = _rooms.asStateFlow()

    private val _activeRoom = MutableStateFlow<WatchRoomDto?>(null)
    val activeRoom: StateFlow<WatchRoomDto?> = _activeRoom.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _playPosition = MutableStateFlow(0L)
    val playPosition: StateFlow<Long> = _playPosition.asStateFlow()

    private val _roomMessages = MutableStateFlow<List<MessageDto>>(emptyList())
    val roomMessages: StateFlow<List<MessageDto>> = _roomMessages.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadRooms()
        subscribeRealtime()
    }

    private fun subscribeRealtime() {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                when (event.name) {
                    "watch:play" -> {
                        _isPlaying.value = true
                        event.data?.let { _playPosition.value = it.optLong("position", 0L) }
                    }
                    "watch:pause" -> {
                        _isPlaying.value = false
                        event.data?.let { _playPosition.value = it.optLong("position", 0L) }
                    }
                    "watch:seek" -> {
                        event.data?.let { _playPosition.value = it.optLong("position", 0L) }
                    }
                    "watch:chat" -> {
                        event.data?.let { data ->
                            val msg = MessageDto(
                                id = data.optString("id"),
                                conversationId = "", // not needed for watch chat UI
                                senderId = data.optString("userId"),
                                content = data.optString("content"),
                                createdAt = data.optLong("createdAt", System.currentTimeMillis()),
                                sender = data.optJSONObject("user")?.let { u ->
                                    UserDto(
                                        id = data.optString("userId"),
                                        username = "",
                                        displayName = u.optString("displayName", "User"),
                                        avatar = u.optString("avatar", null)
                                    )
                                }
                            )
                            _roomMessages.value = listOf(msg) + _roomMessages.value
                        }
                    }
                }
            }
        }
    }

    fun loadRooms() {
        viewModelScope.launch {
            _loading.value = true
            try { _rooms.value = api.getWatchRooms() }
            catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun joinRoom(roomId: String) {
        viewModelScope.launch {
            try {
                val room = api.joinWatchRoom(roomId)
                _activeRoom.value = room
                socketManager.emit("watch:join", JSONObject().put("roomId", roomId))
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun createRoom(name: String, videoUrl: String) {
        viewModelScope.launch {
            try {
                val room = api.createWatchRoom(CreateWatchRoomRequest(name = name, videoUrl = videoUrl))
                _rooms.value = _rooms.value + room
                joinRoom(room.id)
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun leaveRoom() {
        val roomId = _activeRoom.value?.id ?: return
        viewModelScope.launch {
            try {
                api.leaveWatchRoom(roomId)
                socketManager.emit("watch:leave", JSONObject().put("roomId", roomId))
                _activeRoom.value = null
                loadRooms()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun play(position: Long) {
        val roomId = _activeRoom.value?.id ?: return
        _isPlaying.value = true
        socketManager.emit("watch:play", JSONObject().put("roomId", roomId).put("position", position))
    }

    fun pause(position: Long) {
        val roomId = _activeRoom.value?.id ?: return
        _isPlaying.value = false
        socketManager.emit("watch:pause", JSONObject().put("roomId", roomId).put("position", position))
    }

    fun seek(position: Long) {
        val roomId = _activeRoom.value?.id ?: return
        _playPosition.value = position
        socketManager.emit("watch:seek", JSONObject().put("roomId", roomId).put("position", position))
    }

    fun sendChat(content: String) {
        val roomId = _activeRoom.value?.id ?: return
        viewModelScope.launch {
            try { api.sendWatchRoomMessage(roomId, SendMessageRequest(content = content)) }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
}
