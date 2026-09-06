package com.kawaiilife.app.feature.fitness

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FitnessScreen(viewModel: FitnessViewModel = hiltViewModel()) {
    val fitnessEntries by viewModel.fitnessEntries.collectAsState()
    val cardioEntries by viewModel.cardioEntries.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var showLogSheet by remember { mutableStateOf(false) }
    val tabs = listOf("Workouts", "Cardio")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fitness 💪", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.loadAll() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showLogSheet = true },
                containerColor = KawaiiColors.Pink,
                contentColor = Color.White
            ) { Icon(Icons.Default.Add, contentDescription = "Log exercise") }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Stats summary
            stats?.let { s ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard("🏋️", "Workouts", s.totalWorkouts.toString(), modifier = Modifier.weight(1f))
                    StatCard("🔥", "Calories", "${s.totalCalories}", modifier = Modifier.weight(1f))
                    StatCard("📅", "This week", s.weeklyWorkouts.toString(), modifier = Modifier.weight(1f))
                }
            }

            // Tab row
            TabRow(
                selectedTabIndex = tab,
                containerColor = MaterialTheme.colorScheme.background,
                contentColor = KawaiiColors.Pink
            ) {
                tabs.forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) })
                }
            }

            when {
                loading -> LoadingScreen()
                tab == 0 -> {
                    if (fitnessEntries.isEmpty()) {
                        EmptyState(
                            icon = "🏋️",
                            title = "No workouts logged",
                            message = "Tap + to log your first workout",
                            actionLabel = null,
                            onAction = {}
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(fitnessEntries, key = { it.id }) { entry ->
                                WorkoutEntryCard(entry = entry, onDelete = { viewModel.deleteEntry(entry.id) })
                            }
                        }
                    }
                }
                else -> {
                    if (cardioEntries.isEmpty()) {
                        EmptyState(
                            icon = "🏃",
                            title = "No cardio logged",
                            message = "Tap + to log your first cardio session",
                            actionLabel = null,
                            onAction = {}
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(cardioEntries, key = { it.id }) { entry ->
                                CardioEntryCard(entry = entry)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showLogSheet) {
        LogExerciseSheet(
            tab = tab,
            onDismiss = { showLogSheet = false },
            onLogWorkout = { name, sets, reps, weight ->
                viewModel.logFitness(name, sets, reps, weight)
                showLogSheet = false
            },
            onLogCardio = { type, duration, distance, calories ->
                viewModel.logCardio(type, duration, distance, calories)
                showLogSheet = false
            }
        )
    }
}

@Composable
private fun WorkoutEntryCard(entry: FitnessEntryDto, onDelete: () -> Unit) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(entry.exerciseName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(
                    "${entry.sets} sets × ${entry.reps} reps${entry.weight?.let { " @ ${it}kg" } ?: ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = KawaiiColors.Error)
            }
        }
    }
}

@Composable
private fun CardioEntryCard(entry: CardioEntryDto) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(entry.type.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                val details = buildString {
                    append("${entry.duration} min")
                    entry.distance?.let { append(" · ${it}km") }
                    entry.calories?.let { append(" · ${it} kcal") }
                }
                Text(details, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            KawaiiTag(text = "🏃", color = KawaiiColors.Blue)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LogExerciseSheet(
    tab: Int,
    onDismiss: () -> Unit,
    onLogWorkout: (String, Int, Int, Float?) -> Unit,
    onLogCardio: (String, Int, Float?, Int?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var sets by remember { mutableStateOf("3") }
    var reps by remember { mutableStateOf("10") }
    var weight by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf("30") }
    var distance by remember { mutableStateOf("") }
    var calories by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)) {
        Column(
            modifier = Modifier.padding(24.dp).animateContentSize(),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                if (tab == 0) "Log Workout" else "Log Cardio",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            if (tab == 0) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Exercise name") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = sets, onValueChange = { sets = it }, label = { Text("Sets") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = reps, onValueChange = { reps = it }, label = { Text("Reps") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = weight, onValueChange = { weight = it }, label = { Text("kg (opt)") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                }
            } else {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Type (run, bike…)") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = duration, onValueChange = { duration = it }, label = { Text("Min") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = distance, onValueChange = { distance = it }, label = { Text("km (opt)") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = calories, onValueChange = { calories = it }, label = { Text("kcal (opt)") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.weight(1f))
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Cancel") }
                KawaiiButton(
                    text = "Log",
                    onClick = {
                        if (tab == 0) {
                            onLogWorkout(name, sets.toIntOrNull() ?: 3, reps.toIntOrNull() ?: 10, weight.toFloatOrNull())
                        } else {
                            onLogCardio(name, duration.toIntOrNull() ?: 30, distance.toFloatOrNull(), calories.toIntOrNull())
                        }
                    },
                    enabled = name.isNotBlank(),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
