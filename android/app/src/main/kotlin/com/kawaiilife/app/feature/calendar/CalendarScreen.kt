package com.kawaiilife.app.feature.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.EventDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(viewModel: CalendarViewModel = hiltViewModel()) {
    val events by viewModel.events.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    var showAddSheet by remember { mutableStateOf(false) }
    var clickedDate by remember { mutableStateOf<Calendar?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calendar 📅", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddSheet = true },
                containerColor = KawaiiColors.Pink,
                contentColor = Color.White
            ) { Icon(Icons.Default.Add, contentDescription = "Add event") }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Month navigation
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { viewModel.previousMonth() }) {
                    Icon(Icons.Default.ChevronLeft, contentDescription = "Previous month")
                }
                Text(
                    SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(selectedDate.time),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = { viewModel.nextMonth() }) {
                    Icon(Icons.Default.ChevronRight, contentDescription = "Next month")
                }
            }

            // Days of week header
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach { day ->
                    Text(
                        day,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Calendar grid
            CalendarGrid(
                selectedDate = selectedDate,
                events = events,
                onDateClick = { date ->
                    clickedDate = date
                }
            )

            Divider(modifier = Modifier.padding(vertical = 8.dp))

            // Events for selected/clicked date
            val dateToShow = clickedDate ?: selectedDate
            val dayEvents = viewModel.eventsForDate(dateToShow)

            if (loading) {
                LoadingScreen()
            } else if (dayEvents.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("No events on this day", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(dayEvents, key = { it.id }) { event ->
                        EventCard(event = event, onDelete = { viewModel.deleteEvent(event.id) })
                    }
                }
            }
        }
    }

    if (showAddSheet) {
        AddEventSheet(
            onDismiss = { showAddSheet = false },
            onAdd = { title, start, end ->
                viewModel.createEvent(title, start, end)
                showAddSheet = false
            }
        )
    }
}

@Composable
private fun CalendarGrid(
    selectedDate: Calendar,
    events: List<EventDto>,
    onDateClick: (Calendar) -> Unit
) {
    val today = Calendar.getInstance()
    val firstDay = (selectedDate.clone() as Calendar).apply {
        set(Calendar.DAY_OF_MONTH, 1)
    }
    val daysInMonth = selectedDate.getActualMaximum(Calendar.DAY_OF_MONTH)
    val startDow = firstDay.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun

    val cells = buildList {
        repeat(startDow) { add(null) }
        for (d in 1..daysInMonth) {
            val cal = (selectedDate.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, d) }
            add(cal)
        }
    }

    val eventDays = events.map { event ->
        Calendar.getInstance().apply { timeInMillis = event.startTime }.get(Calendar.DAY_OF_MONTH)
    }.toSet()

    Column(modifier = Modifier.padding(horizontal = 8.dp)) {
        cells.chunked(7).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                week.forEach { day ->
                    Box(
                        modifier = Modifier.weight(1f).aspectRatio(1f).padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (day != null) {
                            val dom = day.get(Calendar.DAY_OF_MONTH)
                            val isToday = dom == today.get(Calendar.DAY_OF_MONTH) &&
                                    day.get(Calendar.MONTH) == today.get(Calendar.MONTH) &&
                                    day.get(Calendar.YEAR) == today.get(Calendar.YEAR)
                            val hasEvents = dom in eventDays

                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(if (isToday) KawaiiColors.Pink else Color.Transparent)
                                    .clickable { onDateClick(day) },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    dom.toString(),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (isToday) Color.White else MaterialTheme.colorScheme.onSurface,
                                    fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
                                )
                                if (hasEvents) {
                                    Box(
                                        modifier = Modifier.size(4.dp)
                                            .background(if (isToday) Color.White else KawaiiColors.Purple, CircleShape)
                                    )
                                }
                            }
                        }
                    }
                }
                // Fill remaining cells in last row
                repeat(7 - week.size) {
                    Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                }
            }
        }
    }
}

@Composable
private fun EventCard(event: EventDto, onDelete: () -> Unit) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.width(4.dp).height(40.dp).background(KawaiiColors.Purple, RoundedCornerShape(2.dp)))
                Column {
                    Text(event.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    val fmt = SimpleDateFormat("h:mm a", Locale.getDefault())
                    Text(
                        "${fmt.format(Date(event.startTime))} – ${fmt.format(Date(event.endTime))}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = KawaiiColors.Error)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEventSheet(
    onDismiss: () -> Unit,
    onAdd: (String, Long, Long) -> Unit
) {
    var title by remember { mutableStateOf("") }
    val now = System.currentTimeMillis()

    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("New Event", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("Event title") }, shape = RoundedCornerShape(16.dp),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Cancel") }
                KawaiiButton(
                    text = "Create",
                    onClick = { if (title.isNotBlank()) onAdd(title, now, now + 3_600_000L) },
                    enabled = title.isNotBlank(),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
