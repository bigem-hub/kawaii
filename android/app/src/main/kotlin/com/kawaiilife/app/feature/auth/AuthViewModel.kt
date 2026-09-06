package com.kawaiilife.app.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.auth.TokenStore
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.core.network.SocketManager
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class AuthState {
    object Loading : AuthState()
    object Unauthenticated : AuthState()
    data class Authenticated(val user: UserDto) : AuthState()
}

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        checkAuth()
    }

    private fun checkAuth() {
        if (!tokenStore.hasToken()) {
            _authState.value = AuthState.Unauthenticated
            return
        }
        viewModelScope.launch {
            try {
                val response = api.getMe()
                _authState.value = AuthState.Authenticated(response.user)
                socketManager.connect()
            } catch (e: Exception) {
                tokenStore.clearToken()
                _authState.value = AuthState.Unauthenticated
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState(loading = true)
            try {
                val response = api.login(LoginRequest(email.trim(), password))
                tokenStore.saveToken(response.token)
                _authState.value = AuthState.Authenticated(response.user)
                socketManager.connect()
                _uiState.value = AuthUiState()
            } catch (e: Exception) {
                _uiState.value = AuthUiState(error = e.message ?: "Login failed")
            }
        }
    }

    fun register(email: String, username: String, displayName: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState(loading = true)
            try {
                val response = api.register(
                    RegisterRequest(
                        email = email.trim(),
                        username = username.trim().lowercase(),
                        displayName = displayName.trim(),
                        password = password
                    )
                )
                tokenStore.saveToken(response.token)
                _authState.value = AuthState.Authenticated(response.user)
                socketManager.connect()
                _uiState.value = AuthUiState()
            } catch (e: Exception) {
                _uiState.value = AuthUiState(error = e.message ?: "Registration failed")
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            try { api.logout() } catch (_: Exception) {}
            tokenStore.clearToken()
            socketManager.disconnect()
            _authState.value = AuthState.Unauthenticated
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun getUser(): UserDto? = (_authState.value as? AuthState.Authenticated)?.user
}
