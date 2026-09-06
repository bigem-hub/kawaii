package com.kawaiilife.app.feature.notes

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.TabPosition
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.NoteDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesScreen(viewModel: NotesViewModel = hiltViewModel()) {
    val notes by viewModel.notes.collectAsState()
    val sharedNotes by viewModel.sharedNotes.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var showAddSheet by remember { mutableStateOf(false) }

    val tabs = listOf("Notes", "Shared")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notes 📝", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.toggleArchived() }) {
                        Icon(if (viewModel.showArchived) Icons.Default.Archive else Icons.Default.Archive, contentDescription = "Archive")
                    }
                    IconButton(onClick = { viewModel.loadNotes() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            if (tab == 0) {
                FloatingActionButton(
                    onClick = { showAddSheet = true },
                    containerColor = KawaiiColors.Pink,
                    contentColor = Color.White
                ) { Icon(Icons.Default.Add, contentDescription = "Add note") }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Tab row
            TabRow(
                selectedTabIndex = tab,
                containerColor = MaterialTheme.colorScheme.background,
                contentColor = KawaiiColors.Pink,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[tab]),
                        height = 3.dp,
                        color = KawaiiColors.Pink
                    )
                },
                divider = { Divider(thickness = 0.dp) },
                modifier = Modifier.fillMaxWidth()
            ) {
                tabs.forEachIndexed { i, t ->
                    Tab(
                        selected = tab == i,
                        onClick = { tab = i },
                        text = { Text(t) },
                        selectedContentColor = KawaiiColors.Pink,
                        unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(8.dp))

            // Search
            OutlinedTextField(
                value = viewModel.searchQuery,
                onValueChange = { viewModel.setSearch(it) },
                placeholder = { Text("Search notes…") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth()
            )

            val currentNotes = if (tab == 0) notes else sharedNotes

            when {
                loading -> LoadingScreen()
                currentNotes.isEmpty() -> EmptyState(
                    icon = if (tab == 0) "📝" else "🤝",
                    title = if (tab == 0) "No notes yet" else "No shared notes",
                    message = if (tab == 0) "Tap + to create your first note" else "Notes shared with you will appear here",
                    actionLabel = if (tab == 0) "Create note" else null,
                    onAction = { if (tab == 0) showAddSheet = true }
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(currentNotes, key = { it.id }) { note ->
                        NoteCard(
                            note = note,
                            onTogglePin = { viewModel.togglePin(note) },
                            onDelete = { if (tab == 0) viewModel.deleteNote(note.id) }
                        )
                    }
                }
            }
        }
    }

    if (showAddSheet) {
        AddNoteSheet(
            onDismiss = { showAddSheet = false },
            onAdd = { title, content ->
                viewModel.createNote(title, content)
                showAddSheet = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteCard(
    note: NoteDto,
    onTogglePin: () -> Unit,
    onDelete: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState()
    if (dismissState.currentValue == SwipeToDismissBoxValue.EndToStart) {
        LaunchedEffect(Unit) { onDelete() }
    }

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier.fillMaxSize().background(KawaiiColors.Error.copy(alpha = 0.8f), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.White, modifier = Modifier.padding(end = 20.dp))
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        KawaiiCard {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(note.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            if (note.pinned) {
                                Icon(Icons.Default.PushPin, contentDescription = "Pinned", tint = KawaiiColors.Pink, modifier = Modifier.size(16.dp))
                            }
                        }
                        note.content?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddNoteSheet(
    onDismiss: () -> Unit,
    onAdd: (String, String?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("New Note", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("Title") }, shape = RoundedCornerShape(16.dp),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = content, onValueChange = { content = it },
                label = { Text("Content (optional)") },
                shape = RoundedCornerShape(16.dp),
                singleLine = false, minLines = 4, modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Cancel") }
                KawaiiButton(text = "Save", onClick = { if (title.isNotBlank()) onAdd(title, content) }, enabled = title.isNotBlank(), modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}