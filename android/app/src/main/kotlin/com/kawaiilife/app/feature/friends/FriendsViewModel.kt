package com.kawaiilife.app.feature.friends

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FriendsViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    private val _friends = MutableStateFlow<List<FriendDto>>(emptyList())
    val friends: StateFlow<List<FriendDto>> = _friends.asStateFlow()

    private val _requests = MutableStateFlow<List<FriendRequestDto>>(emptyList())
    val requests: StateFlow<List<FriendRequestDto>> = _requests.asStateFlow()

    private val _searchResults = MutableStateFlow<List<UserDto>>(emptyList())
    val searchResults: StateFlow<List<UserDto>> = _searchResults.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadFriends()
        loadRequests()
    }

    fun loadFriends() {
        viewModelScope.launch {
            _loading.value = true
            try { _friends.value = api.getFriends() }
            catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun loadRequests() {
        viewModelScope.launch {
            try { _requests.value = api.getFriendRequests() }
            catch (e: Exception) { /* silent */ }
        }
    }

    fun search(query: String) {
        if (query.isBlank()) { _searchResults.value = emptyList(); return }
        viewModelScope.launch {
            try { _searchResults.value = api.searchUsers(query) }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun sendRequest(userId: String) {
        viewModelScope.launch {
            try { api.sendFriendRequest(mapOf("userId" to userId)); loadRequests() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun acceptRequest(requestId: String) {
        viewModelScope.launch {
            try { api.acceptFriendRequest(requestId); loadFriends(); loadRequests() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun declineRequest(requestId: String) {
        viewModelScope.launch {
            try { api.declineFriendRequest(requestId); loadRequests() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun removeFriend(friendId: String) {
        viewModelScope.launch {
            try { api.removeFriend(friendId); loadFriends() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
}
