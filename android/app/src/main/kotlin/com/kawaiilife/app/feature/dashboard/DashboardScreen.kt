package com.kawaiilife.app.feature.dashboard

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateTo: (String) -> Unit
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🌸 ", fontSize = 20.sp)
                        Text(
                            "KawaiiLife",
                            fontWeight = FontWeight.Bold,
                            color = KawaiiColors.Pink
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { onNavigateTo("notifications") }) {
                        Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                    }
                    IconButton(onClick = { onNavigateTo("profile") }) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Profile")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        when (state) {
            is DashboardState.Loading -> LoadingScreen()
            is DashboardState.Error -> {
                val msg = (state as DashboardState.Error).message
                EmptyState(
                    icon = "😢",
                    title = "Couldn't load dashboard",
                    message = msg,
                    actionLabel = "Retry",
                    onAction = { viewModel.load() }
                )
            }
            is DashboardState.Success -> {
                val data = (state as DashboardState.Success).data
                DashboardContent(
                    data = data,
                    onNavigateTo = onNavigateTo,
                    onRefresh = { viewModel.load() },
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun DashboardContent(
    data: DashboardDto,
    onNavigateTo: (String) -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Greeting
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val greeting = data.greeting ?: when {
            hour < 12 -> "Good morning"
            hour < 17 -> "Good afternoon"
            else      -> "Good evening"
        }
        data.user?.let { user ->
            Column {
                Text(
                    "$greeting, ${user.displayName}! ✨",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                data.motivation?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KawaiiTag("🔥 ${user.streak} day streak", KawaiiColors.Pink)
                    KawaiiTag("⭐ ${user.xp} XP", KawaiiColors.Purple)
                    KawaiiTag("Lv.${user.level}", KawaiiColors.Blue)
                }
                Spacer(Modifier.height(8.dp))
                // XP Progress bar
                val xpForLevel = user.level * 100
                KawaiiProgressBar(
                    progress = (user.xp % xpForLevel) / xpForLevel.toFloat(),
                    modifier = Modifier.fillMaxWidth().height(6.dp)
                )
                Text(
                    "${user.xp % xpForLevel} / $xpForLevel XP to next level",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Quick stats row
        data.taskStats?.let { stats ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    "✅", "Done today",
                    stats.completedToday.toString(),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    "📋", "Pending",
                    stats.pending.toString(),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    "💬", "Unread",
                    data.unreadMessages.toString(),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Quick action tiles
        SectionHeader("Quick Actions")
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val actions = listOf(
                Triple("✅", "Tasks",    "tasks"),
                Triple("📝", "Notes",    "notes"),
                Triple("💬", "Chat",     "chat"),
                Triple("📅", "Calendar", "calendar"),
                Triple("🏃", "Fitness",  "fitness"),
                Triple("🎬", "Watch",    "watch"),
                Triple("📊", "Stats",    "stats"),
                Triple("⚙️", "Settings", "settings")
            )
            items(actions) { (emoji, label, route) ->
                QuickActionCard(emoji = emoji, label = label, onClick = { onNavigateTo(route) })
            }
        }

        // Today's tasks
        if (data.todayTasks.isNotEmpty()) {
            SectionHeader(
                "Today's Tasks",
                action = { TextButton(onClick = { onNavigateTo("tasks") }) { Text("See all") } }
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                data.todayTasks.take(5).forEach { task ->
                    TaskDashCard(task = task)
                }
            }
        }

        // Upcoming events
        if (data.upcomingEvents.isNotEmpty()) {
            SectionHeader(
                "Upcoming Events",
                action = { TextButton(onClick = { onNavigateTo("calendar") }) { Text("See all") } }
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                data.upcomingEvents.take(3).forEach { event ->
                    EventDashCard(event = event)
                }
            }
        }

        // Recent notes
        if (data.quickNotes.isNotEmpty()) {
            SectionHeader(
                "Recent Notes",
                action = { TextButton(onClick = { onNavigateTo("notes") }) { Text("See all") } }
            )
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(data.quickNotes.take(5)) { note ->
                    NoteDashCard(note = note)
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun QuickActionCard(emoji: String, label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
        modifier = Modifier.size(72.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(emoji, fontSize = 24.sp)
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun TaskDashCard(task: com.kawaiilife.app.data.model.TaskDto) {
    KawaiiCard {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                if (task.completed) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                contentDescription = null,
                tint = if (task.completed) KawaiiColors.Success else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(task.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                task.dueDate?.let { due ->
                    Text(
                        formatTimestamp(due),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            PriorityBadge(task.priority)
        }
    }
}

@Composable
private fun EventDashCard(event: com.kawaiilife.app.data.model.EventDto) {
    val accentColor = if (event.color != null) {
        try { Color(android.graphics.Color.parseColor(event.color)) }
        catch (_: Exception) { KawaiiColors.Blue }
    } else KawaiiColors.Blue

    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(40.dp)
                    .background(accentColor, RoundedCornerShape(50))
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(event.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text(
                    formatTimestamp(event.startTime),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun NoteDashCard(note: com.kawaiilife.app.data.model.NoteDto) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
        modifier = Modifier.width(160.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(note.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 2)
            note.content?.let {
                Text(it, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3)
            }
        }
    }
}

private fun formatTimestamp(ms: Long): String {
    val sdf = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
    return sdf.format(Date(ms))
}
