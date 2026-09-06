package com.kawaiilife.app.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.auth.TokenStore
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore
) : ViewModel() {

    private val _profile = MutableStateFlow<UserProfileDto?>(null)
    val profile: StateFlow<UserProfileDto?> = _profile.asStateFlow()

    private val _achievements = MutableStateFlow<List<AchievementDto>>(emptyList())
    val achievements: StateFlow<List<AchievementDto>> = _achievements.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _saveSuccess = MutableStateFlow(false)
    val saveSuccess: StateFlow<Boolean> = _saveSuccess.asStateFlow()

    init { loadProfile() }

    fun loadProfile() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _profile.value = api.getMyProfile()
                _achievements.value = api.getAchievements()
            } catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun updateProfile(displayName: String, bio: String?) {
        viewModelScope.launch {
            try {
                _profile.value = api.updateProfile(UpdateProfileRequest(displayName = displayName, bio = bio))
                _saveSuccess.value = true
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun logout() {
        tokenStore.clearToken()
    }

    fun clearError() { _error.value = null }
    fun clearSaveSuccess() { _saveSuccess.value = false }
}
