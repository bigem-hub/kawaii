package com.kawaiilife.app.feature.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.*
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    private val _events = MutableStateFlow<List<EventDto>>(emptyList())
    val events: StateFlow<List<EventDto>> = _events.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _selectedDate = MutableStateFlow(Calendar.getInstance())
    val selectedDate: StateFlow<Calendar> = _selectedDate.asStateFlow()

    init { loadEvents() }

    fun loadEvents() {
        viewModelScope.launch {
            _loading.value = true
            try {
                val cal = _selectedDate.value
                val year = cal.get(Calendar.YEAR)
                val month = cal.get(Calendar.MONTH) + 1
                _events.value = api.getEvents(year = year, month = month)
            } catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun selectDate(date: Calendar) {
        _selectedDate.value = date
        loadEvents()
    }

    fun previousMonth() {
        val cal = _selectedDate.value.clone() as Calendar
        cal.add(Calendar.MONTH, -1)
        selectDate(cal)
    }

    fun nextMonth() {
        val cal = _selectedDate.value.clone() as Calendar
        cal.add(Calendar.MONTH, 1)
        selectDate(cal)
    }

    fun createEvent(title: String, startTime: Long, endTime: Long, description: String? = null) {
        viewModelScope.launch {
            try {
                api.createEvent(CreateEventRequest(
                    title = title,
                    startTime = startTime,
                    endTime = endTime,
                    description = description
                ))
                loadEvents()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun deleteEvent(id: String) {
        viewModelScope.launch {
            try { api.deleteEvent(id); loadEvents() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun eventsForDate(date: Calendar): List<EventDto> {
        return _events.value.filter { event ->
            val eventCal = Calendar.getInstance().apply { timeInMillis = event.startTime }
            eventCal.get(Calendar.DAY_OF_YEAR) == date.get(Calendar.DAY_OF_YEAR) &&
                    eventCal.get(Calendar.YEAR) == date.get(Calendar.YEAR)
        }
    }

    fun clearError() { _error.value = null }
}
