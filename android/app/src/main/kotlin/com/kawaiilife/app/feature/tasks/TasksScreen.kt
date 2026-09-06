package com.kawaiilife.app.feature.tasks

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.TaskDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(viewModel: TasksViewModel = hiltViewModel()) {
    val tasks by viewModel.tasks.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val error by viewModel.error.collectAsState()
    var showAddSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks ✅", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.loadTasks() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddSheet = true },
                containerColor = KawaiiColors.Pink,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add task")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Search bar
            OutlinedTextField(
                value = viewModel.searchQuery,
                onValueChange = { viewModel.setSearch(it) },
                placeholder = { Text("Search tasks…") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Category filter chips
            if (categories.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = viewModel.selectedCategory == null,
                            onClick = { viewModel.setCategory(null) },
                            label = { Text("All") }
                        )
                    }
                    items(categories) { cat ->
                        FilterChip(
                            selected = viewModel.selectedCategory == cat.id,
                            onClick = { viewModel.setCategory(cat.id) },
                            label = { Text("${cat.icon} ${cat.name}") }
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            // Priority chips
            LazyRow(
                modifier = Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item { FilterChip(selected = viewModel.selectedPriority == null, onClick = { viewModel.setPriority(null) }, label = { Text("Any priority") }) }
                listOf("high", "medium", "low").forEach { p ->
                    item {
                        FilterChip(
                            selected = viewModel.selectedPriority == p,
                            onClick = { viewModel.setPriority(p) },
                            label = { Text(p.replaceFirstChar { it.uppercase() }) }
                        )
                    }
                }
            }
            Spacer(Modifier.height(8.dp))

            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp))
            }

            when {
                loading -> LoadingScreen()
                tasks.isEmpty() -> EmptyState(
                    icon = "✅",
                    title = "No tasks yet",
                    message = "Tap + to add your first task!",
                    actionLabel = "Add task",
                    onAction = { showAddSheet = true }
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(tasks, key = { it.id }) { task ->
                        TaskCard(
                            task = task,
                            onToggle = { viewModel.toggleComplete(task) },
                            onDelete = { viewModel.deleteTask(task.id) }
                        )
                    }
                }
            }
        }
    }

    if (showAddSheet) {
        AddTaskSheet(
            onDismiss = { showAddSheet = false },
            onAdd = { title, priority, dueDate ->
                viewModel.createTask(title, priority, dueDate)
                showAddSheet = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskCard(
    task: TaskDto,
    onToggle: () -> Unit,
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
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.White,
                    modifier = Modifier.padding(end = 20.dp))
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        KawaiiCard {
            Row(
                modifier = Modifier.fillMaxWidth().padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Checkbox(
                    checked = task.completed,
                    onCheckedChange = { onToggle() },
                    colors = CheckboxDefaults.colors(checkedColor = KawaiiColors.Pink)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        task.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = if (task.completed)
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        else MaterialTheme.colorScheme.onSurface
                    )
                    task.dueDate?.let { due ->
                        val isOverdue = !task.completed && due < System.currentTimeMillis()
                        Text(
                            SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(due)),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isOverdue) KawaiiColors.Error else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (task.subtasks.isNotEmpty()) {
                        val done = task.subtasks.count { it.completed }
                        Text(
                            "$done/${task.subtasks.size} subtasks",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                PriorityBadge(task.priority)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddTaskSheet(
    onDismiss: () -> Unit,
    onAdd: (String, String?, Long?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("New Task", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Task title") },
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Text("Priority", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("high", "medium", "low").forEach { p ->
                    FilterChip(
                        selected = priority == p,
                        onClick = { priority = if (priority == p) null else p },
                        label = { Text(p.replaceFirstChar { it.uppercase() }) }
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) {
                    Text("Cancel")
                }
                KawaiiButton(
                    text = "Add Task",
                    onClick = { if (title.isNotBlank()) onAdd(title, priority, null) },
                    enabled = title.isNotBlank(),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
