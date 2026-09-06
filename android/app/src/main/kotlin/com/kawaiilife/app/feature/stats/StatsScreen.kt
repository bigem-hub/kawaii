package com.kawaiilife.app.feature.stats

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatsViewModel @Inject constructor(private val api: ApiService) : ViewModel() {
    private val _dashboard = MutableStateFlow<DashboardDto?>(null)
    val dashboard: StateFlow<DashboardDto?> = _dashboard.asStateFlow()

    private val _taskStats = MutableStateFlow<TaskStatsDto?>(null)
    val taskStats: StateFlow<TaskStatsDto?> = _taskStats.asStateFlow()

    private val _fitnessStats = MutableStateFlow<FitnessStatsDto?>(null)
    val fitnessStats: StateFlow<FitnessStatsDto?> = _fitnessStats.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _dashboard.value = api.getDashboard()
                _taskStats.value = api.getTaskStats()
                _fitnessStats.value = api.getFitnessStats()
            } catch (_: Exception) {}
            finally { _loading.value = false }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(viewModel: StatsViewModel = hiltViewModel()) {
    val dashboard by viewModel.dashboard.collectAsState()
    val taskStats by viewModel.taskStats.collectAsState()
    val fitnessStats by viewModel.fitnessStats.collectAsState()
    val loading by viewModel.loading.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Statistics 📊", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        if (loading) { LoadingScreen(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text("Overview", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    dashboard?.let { d ->
                        StatCard("⚡", "XP", (d.user?.xp ?: 0).toString(), modifier = Modifier.weight(1f))
                        StatCard("🔥", "Streak", "${d.user?.streak ?: 0}d", modifier = Modifier.weight(1f))
                        StatCard("✅", "Tasks done", (d.taskStats?.completed ?: 0).toString(), modifier = Modifier.weight(1f))
                    }
                }
            }

            taskStats?.let { ts ->
                item {
                    SectionCard(title = "Tasks 📋") {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatRow("Total tasks", ts.total.toString())
                            StatRow("Completed", ts.completed.toString())
                            StatRow("Pending", ts.pending.toString())
                            StatRow("Overdue", ts.overdue.toString())
                            Spacer(Modifier.height(4.dp))
                            KawaiiProgressBar(
                                progress = ts.percentage.toFloat() / 100f,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Text(
                                "${ts.percentage}% completion rate",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            fitnessStats?.let { fs ->
                item {
                    SectionCard(title = "Fitness 💪") {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatRow("Total workouts", fs.totalWorkouts.toString())
                            StatRow("This week", fs.weeklyWorkouts.toString())
                            StatRow("Calories burned", "${fs.totalCalories} kcal")
                            fs.totalDistance?.let { StatRow("Distance run", "${it} km") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    KawaiiCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            content()
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
