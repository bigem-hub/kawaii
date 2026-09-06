package com.kawaiilife.app.feature.fitness

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FitnessViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    private val _fitnessEntries = MutableStateFlow<List<FitnessEntryDto>>(emptyList())
    val fitnessEntries: StateFlow<List<FitnessEntryDto>> = _fitnessEntries.asStateFlow()

    private val _cardioEntries = MutableStateFlow<List<CardioEntryDto>>(emptyList())
    val cardioEntries: StateFlow<List<CardioEntryDto>> = _cardioEntries.asStateFlow()

    private val _routines = MutableStateFlow<List<WorkoutRoutineDto>>(emptyList())
    val routines: StateFlow<List<WorkoutRoutineDto>> = _routines.asStateFlow()

    private val _stats = MutableStateFlow<FitnessStatsDto?>(null)
    val stats: StateFlow<FitnessStatsDto?> = _stats.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadAll()
    }

    fun loadAll() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _fitnessEntries.value = api.getFitnessEntries()
                _cardioEntries.value = api.getCardioEntries()
                _routines.value = api.getWorkoutRoutines()
                _stats.value = api.getFitnessStats()
            } catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun logFitness(exerciseName: String, sets: Int, reps: Int, weight: Float?) {
        viewModelScope.launch {
            try {
                api.createFitnessEntry(CreateFitnessEntryRequest(
                    exerciseName = exerciseName,
                    sets = sets,
                    reps = reps,
                    weight = weight
                ))
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun logCardio(type: String, duration: Int, distance: Float?, calories: Int?) {
        viewModelScope.launch {
            try {
                api.createCardioEntry(CreateCardioEntryRequest(
                    type = type,
                    duration = duration,
                    distance = distance,
                    calories = calories
                ))
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun deleteEntry(id: String) {
        viewModelScope.launch {
            try { api.deleteFitnessEntry(id); loadAll() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
}
