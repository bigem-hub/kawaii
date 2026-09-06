package com.kawaiilife.app.feature.notes

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
class NotesViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    private val _notes = MutableStateFlow<List<NoteDto>>(emptyList())
    val notes: StateFlow<List<NoteDto>> = _notes.asStateFlow()

    private val _sharedNotes = MutableStateFlow<List<NoteDto>>(emptyList())
    val sharedNotes: StateFlow<List<NoteDto>> = _sharedNotes.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    var showArchived: Boolean = false
        private set
    var searchQuery: String = ""
        private set

    init {
        loadNotes()
        loadSharedNotes()
    }

    fun loadNotes() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _notes.value = api.getNotes(archived = showArchived, search = searchQuery.takeIf { it.isNotBlank() })
            } catch (e: Exception) { _error.value = e.message }
            finally { _loading.value = false }
        }
    }

    fun loadSharedNotes() {
        viewModelScope.launch {
            try { _sharedNotes.value = api.getSharedNotes() }
            catch (_: Exception) {}
        }
    }

    fun setSearch(q: String) { searchQuery = q; loadNotes() }
    fun toggleArchived() { showArchived = !showArchived; loadNotes() }

    fun createNote(title: String, content: String? = null) {
        viewModelScope.launch {
            try {
                api.createNote(CreateNoteRequest(title = title, content = content))
                loadNotes()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun deleteNote(id: String) {
        viewModelScope.launch {
            try { api.deleteNote(id); loadNotes() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun togglePin(note: NoteDto) {
        viewModelScope.launch {
            try { api.updateNote(note.id, mapOf("pinned" to !note.pinned)); loadNotes() }
            catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
}