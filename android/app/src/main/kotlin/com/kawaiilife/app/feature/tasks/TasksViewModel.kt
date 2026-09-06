package com.kawaiilife.app.feature.tasks

import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TasksViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    private val _tasks = MutableStateFlow<List<TaskDto>>(emptyList())
    val tasks: StateFlow<List<TaskDto>> = _tasks.asStateFlow()

    private val _categories = MutableStateFlow<List<CategoryDto>>(emptyList())
    val categories: StateFlow<List<CategoryDto>> = _categories.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    var selectedCategory: String? = null
        private set
    var selectedPriority: String? = null
        private set
    var searchQuery: String = ""
        private set

    init {
        loadTasks()
        loadCategories()
    }

    fun loadTasks() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _tasks.value = api.getTasks(
                    category = selectedCategory,
                    priority = selectedPriority,
                    search = searchQuery.takeIf { it.isNotBlank() }
                )
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _loading.value = false
            }
        }
    }

    private fun loadCategories() {
        viewModelScope.launch {
            try { _categories.value = api.getCategories() }
            catch (_: Exception) {}
        }
    }

    fun setCategory(id: String?) { selectedCategory = id; loadTasks() }
    fun setPriority(p: String?) { selectedPriority = p; loadTasks() }
    fun setSearch(q: String) { searchQuery = q; loadTasks() }

    fun toggleComplete(task: TaskDto) {
        viewModelScope.launch {
            try {
                api.updateTask(task.id, mapOf("completed" to !task.completed))
                loadTasks()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun createTask(title: String, priority: String? = null, dueDate: Long? = null, categoryId: String? = null) {
        viewModelScope.launch {
            try {
                api.createTask(CreateTaskRequest(
                    title = title,
                    priority = priority,
                    dueDate = dueDate,
                    categoryId = categoryId
                ))
                loadTasks()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun deleteTask(id: String) {
        viewModelScope.launch {
            try { api.deleteTask(id); loadTasks() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
}
