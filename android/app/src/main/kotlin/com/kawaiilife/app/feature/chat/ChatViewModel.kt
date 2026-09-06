package com.kawaiilife.app.feature.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.core.network.SocketManager
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.data.repository.FirebaseRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val api: ApiService,
    private val socketManager: SocketManager,
    private val firebaseRepository: FirebaseRepository
) : ViewModel() {

    private val _conversations = MutableStateFlow<List<ConversationDto>>(emptyList())
    val conversations: StateFlow<List<ConversationDto>> = _conversations.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            try { _conversations.value = api.getConversations() }
            catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun createDirect(friendId: String) {
        viewModelScope.launch {
            try {
                val conv = api.getOrCreateDirect(mapOf("friendId" to friendId))
                _conversations.value = _conversations.value + conv
            } catch (e: Exception) { _error.value = e.message }
        }
    }
}

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val api: ApiService,
    private val socketManager: SocketManager,
    private val firebaseRepository: FirebaseRepository
) : ViewModel() {

    private val _messages = MutableStateFlow<List<MessageDto>>(emptyList())
    val messages: StateFlow<List<MessageDto>> = _messages.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _typingUsers = MutableStateFlow<Map<String, String>>(emptyMap()) // convId -> userId
    val typingUsers: StateFlow<Map<String, String>> = _typingUsers.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var conversationId: String = ""

    fun init(conversationId: String) {
        this.conversationId = conversationId
        loadMessages()
        subscribeRealtime()
        // Alternative: Use Firebase for realtime updates
        // observeFirebaseMessages()
    }

    private fun observeFirebaseMessages() {
        viewModelScope.launch {
            firebaseRepository.getMessages(conversationId).collect { firebaseMessages ->
                _messages.value = firebaseMessages
            }
        }
    }

    private fun subscribeRealtime() {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                when (event.name) {
                    "chat:message" -> {
                        event.data?.let { data ->
                            val msg = parseMessage(data)
                            if (msg.conversationId == conversationId) {
                                _messages.value = _messages.value + msg
                            }
                        }
                    }
                    "chat:typing" -> {
                        event.data?.let { data ->
                            val userId = data.optString("userId")
                            val isTyping = data.optBoolean("isTyping")
                            val convId = data.optString("conversationId")
                            if (convId == conversationId) {
                                if (isTyping) _typingUsers.value = _typingUsers.value + (convId to userId)
                                else _typingUsers.value = _typingUsers.value - convId
                            }
                        }
                    }
                }
            }
        }
    }

    private fun parseMessage(data: JSONObject): MessageDto {
        // Simplified - in production use Moshi to parse
        return MessageDto(
            id = data.optString("id"),
            conversationId = data.optString("conversationId"),
            senderId = data.optString("senderId"),
            content = data.optString("content"),
            type = data.optString("type", "text"),
            replyTo = data.optString("replyTo", null),
            fileUrl = data.optString("fileUrl", null),
            fileName = data.optString("fileName", null),
            fileType = data.optString("fileType", null),
            edited = data.optBoolean("edited", false),
            deleted = data.optBoolean("deleted", false),
            createdAt = data.optLong("createdAt", 0L),
            sender = null,
            reactions = emptyList()
        )
    }

    fun loadMessages() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _messages.value = api.getMessages(conversationId)
                socketManager.emit("chat:markRead", JSONObject().put("conversationId", conversationId))
            } catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun sendMessage(content: String) {
        viewModelScope.launch {
            try {
                val msg = api.sendMessage(conversationId, SendMessageRequest(content = content))
                _messages.value = _messages.value + msg
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun setTyping(isTyping: Boolean) {
        socketManager.emit("chat:typing", JSONObject().apply {
            put("conversationId", conversationId)
            put("isTyping", isTyping)
        })
    }

    fun clearError() { _error.value = null }
}