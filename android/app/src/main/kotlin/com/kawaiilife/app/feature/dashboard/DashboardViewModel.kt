package com.kawaiilife.app.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.DashboardDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: ApiService
) : ViewModel() {

    private val _state = MutableStateFlow<DashboardState>(DashboardState.Loading)
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = DashboardState.Loading
            try {
                val data = api.getDashboard()
                _state.value = DashboardState.Success(data)
            } catch (e: Exception) {
                _state.value = DashboardState.Error(e.message ?: "Failed to load dashboard")
            }
        }
    }
}

sealed class DashboardState {
    object Loading : DashboardState()
    data class Success(val data: DashboardDto) : DashboardState()
    data class Error(val message: String) : DashboardState()
}
