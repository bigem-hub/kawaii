package com.kawaiilife.app.data.model

import com.squareup.moshi.JsonClass

// ── Auth ──────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class LoginRequest(val email: String, val password: String)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val email: String,
    val username: String,
    val displayName: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class AuthResponse(val user: UserDto, val token: String)

@JsonClass(generateAdapter = true)
data class MeResponse(val user: UserDto)

@JsonClass(generateAdapter = true)
data class UpdateProfileRequest(
    val displayName: String? = null,
    val bio: String? = null,
    val avatar: String? = null
)

// ── User ──────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String? = null,
    val username: String,
    val displayName: String,
    val avatar: String? = null,
    val bio: String? = null,
    val online: Boolean = false,
    val xp: Int = 0,
    val level: Int = 1,
    val streak: Int = 0,
    val longestStreak: Int = 0,
    val lastSeen: Long? = null,
    val createdAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class UserProfileDto(
    val id: String = "",
    val username: String = "",
    val displayName: String = "",
    val avatar: String? = null,
    val bio: String? = null,
    val level: Int = 1,
    val xp: Int = 0,
    val streak: Int = 0,
    val online: Boolean = false,
    val stats: UserStats? = null,
    val socialLinks: List<SocialLinkDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class UserStats(
    val tasks: Int = 0,
    val notes: Int = 0,
    val friends: Int = 0
)

// ── Friends ───────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class FriendDto(
    val id: String,
    val displayName: String,
    val avatar: String? = null,
    val online: Boolean = false,
    val username: String = ""
)

@JsonClass(generateAdapter = true)
data class FriendRequestDto(
    val id: String,
    val fromUserId: String,
    val toUserId: String? = null,
    val status: String = "pending",
    val createdAt: Long = 0L,
    val sender: UserDto? = null
)

@JsonClass(generateAdapter = true)
data class SocialLinkDto(
    val id: String,
    val userId: String? = null,
    val platform: String,
    val url: String,
    val label: String = "",
    val sortOrder: Int = 0
)

@JsonClass(generateAdapter = true)
data class CreateSocialLinkRequest(
    val platform: String,
    val url: String,
    val label: String = "",
    val sortOrder: Int = 0
)

// ── Tasks ─────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class TaskDto(
    val id: String,
    val userId: String? = null,
    val title: String,
    val description: String? = null,
    val notes: String? = null,
    val categoryId: String? = null,
    val priority: String? = null,
    val completed: Boolean = false,
    val completedAt: Long? = null,
    val dueDate: Long? = null,
    val startDate: Long? = null,
    val tags: String? = null,
    val recurring: String? = null,
    val reminderAt: Long? = null,
    val sortOrder: Int = 0,
    val createdAt: Long = 0L,
    val subtasks: List<SubtaskDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SubtaskDto(
    val id: String,
    val taskId: String,
    val title: String,
    val completed: Boolean = false,
    val sortOrder: Int = 0
)

@JsonClass(generateAdapter = true)
data class CategoryDto(
    val id: String,
    val userId: String? = null,
    val name: String,
    val color: String = "#FF8FAB",
    val icon: String = "📁",
    val isDefault: Boolean = false,
    val sortOrder: Int = 0
)

@JsonClass(generateAdapter = true)
data class TaskStatsDto(
    val total: Int = 0,
    val completed: Int = 0,
    val pending: Int = 0,
    val overdue: Int = 0,
    val completedToday: Int = 0,
    val percentage: Int = 0
)

@JsonClass(generateAdapter = true)
data class CreateTaskRequest(
    val title: String,
    val description: String? = null,
    val categoryId: String? = null,
    val priority: String? = null,
    val dueDate: Long? = null,
    val tags: String? = null,
    val reminderAt: Long? = null
)

@JsonClass(generateAdapter = true)
data class CreateCategoryRequest(
    val name: String,
    val color: String,
    val icon: String
)

// ── Notes ──────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class NoteDto(
    val id: String,
    val userId: String? = null,
    val title: String,
    val content: String? = null,
    val type: String = "note",
    val tags: String? = null,
    val pinned: Boolean = false,
    val archived: Boolean = false,
    val favorite: Boolean = false,
    val shareStatus: String = "private",
    val studyHours: Double = 0.0,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class NoteCommentDto(
    val id: String,
    val noteId: String,
    val userId: String,
    val content: String,
    val createdAt: Long = 0L,
    val user: UserDto? = null
)

@JsonClass(generateAdapter = true)
data class NoteShareDto(
    val id: String,
    val noteId: String,
    val userId: String? = null,
    val permission: String = "view",
    val shareLink: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateNoteRequest(
    val title: String,
    val content: String? = null,
    val type: String = "note",
    val tags: String? = null,
    val categoryId: String? = null
)

// ── Chat ──────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ConversationDto(
    val id: String,
    val type: String = "direct",
    val name: String? = null,
    val avatar: String? = null,
    val createdAt: Long = 0L,
    val members: List<UserDto> = emptyList(),
    val lastMessage: MessageDto? = null,
    val unreadCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class MessageDto(
    val id: String = "",
    val conversationId: String = "",
    val senderId: String = "",
    val content: String = "",
    val type: String = "text",
    val replyTo: String? = null,
    val fileUrl: String? = null,
    val fileName: String? = null,
    val fileType: String? = null,
    val edited: Boolean = false,
    val deleted: Boolean = false,
    val createdAt: Long = 0L,
    val sender: UserDto? = null,
    val reactions: List<ReactionDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class ReactionDto(
    val emoji: String,
    val count: Int,
    val users: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SendMessageRequest(
    val content: String,
    val type: String = "text",
    val replyTo: String? = null,
    val fileUrl: String? = null,
    val fileName: String? = null,
    val fileType: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateGroupRequest(
    val name: String,
    val memberIds: List<String>
)

// ── Calendar ──────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class EventDto(
    val id: String,
    val userId: String? = null,
    val title: String,
    val type: String = "event",
    val startTime: Long = 0L,   // normalised field used in screens
    val endTime: Long = 0L,
    val allDay: Boolean = false,
    val location: String? = null,
    val description: String? = null,
    val color: String? = null,
    val linkedTaskId: String? = null,
    val createdAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class ReminderDto(
    val id: String,
    val userId: String? = null,
    val title: String,
    val datetime: Long = 0L,
    val repeat: String? = null,
    val completed: Boolean = false,
    val linkedTaskId: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateEventRequest(
    val title: String,
    val startTime: Long,
    val endTime: Long,
    val description: String? = null,
    val type: String = "event",
    val allDay: Boolean = false,
    val location: String? = null,
    val color: String? = null,
    val linkedTaskId: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateReminderRequest(
    val title: String,
    val datetime: Long,
    val repeat: String? = null,
    val linkedTaskId: String? = null
)

// ── Fitness ───────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class FitnessEntryDto(
    val id: String = "",
    val userId: String? = null,
    val exerciseName: String = "",
    val sets: Int = 0,
    val reps: Int = 0,
    val weight: Float? = null,
    val date: String = "",
    val createdAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class CreateFitnessEntryRequest(
    val exerciseName: String,
    val sets: Int,
    val reps: Int,
    val weight: Float? = null
)

@JsonClass(generateAdapter = true)
data class CardioEntryDto(
    val id: String,
    val userId: String? = null,
    val type: String,
    val duration: Int = 0,   // minutes
    val distance: Float? = null,
    val calories: Int? = null,
    val date: String = "",
    val createdAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class CreateCardioEntryRequest(
    val type: String,
    val duration: Int,
    val distance: Float? = null,
    val calories: Int? = null
)

@JsonClass(generateAdapter = true)
data class WorkoutRoutineDto(
    val id: String,
    val userId: String? = null,
    val name: String,
    val description: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val exercises: List<WorkoutExerciseDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkoutExerciseDto(
    val id: String? = null,
    val routineId: String? = null,
    val name: String,
    val sets: Int = 3,
    val reps: Int = 10,
    val restSeconds: Int = 60,
    val notes: String? = null,
    val sortOrder: Int = 0
)

@JsonClass(generateAdapter = true)
data class FitnessStatsDto(
    val totalWorkouts: Int = 0,
    val weeklyWorkouts: Int = 0,
    val totalCalories: Int = 0,
    val totalDistance: Float? = null,
    val totalMinutes: Int = 0,
    val workoutStreak: Int = 0
)

// ── Watch Party ───────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class WatchRoomDto(
    val id: String,
    val name: String,
    val code: String = "",
    val hostId: String? = null,
    val videoUrl: String = "",
    val privacy: String = "public",
    val isActive: Boolean = true,
    val createdAt: Long = 0L,
    val participants: List<UserDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CreateWatchRoomRequest(
    val name: String,
    val videoUrl: String,
    val privacy: String = "public"
)

// ── Notifications ─────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class NotificationDto(
    val id: String,
    val userId: String? = null,
    val type: String,
    val title: String,
    val body: String? = null,
    val data: String? = null,
    val read: Boolean = false,
    val createdAt: Long = 0L
)

@JsonClass(generateAdapter = true)
data class UnreadCountDto(val count: Int)

@JsonClass(generateAdapter = true)
data class AchievementDto(
    val id: String,
    val key: String = "",
    val name: String,
    val description: String = "",
    val icon: String,
    val xpReward: Int = 0,
    val earned: Boolean = false,
    val earnedAt: Long? = null
)

// ── Dashboard ─────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class DashboardDto(
    val user: UserDto? = null,
    val todayTasks: List<TaskDto> = emptyList(),
    val quickNotes: List<NoteDto> = emptyList(),
    val upcomingEvents: List<EventDto> = emptyList(),
    val greeting: String? = null,
    val motivation: String? = null,
    val unreadMessages: Int = 0,
    val taskStats: TaskStatsDto? = null
)

// ── Misc ──────────────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class SuccessResponse(val success: Boolean = true)

@JsonClass(generateAdapter = true)
data class SearchResultsDto(
    val tasks: List<TaskDto> = emptyList(),
    val notes: List<NoteDto> = emptyList(),
    val users: List<UserDto> = emptyList(),
    val events: List<EventDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CalendarCombinedDto(
    val events: List<EventDto> = emptyList(),
    val tasks: List<TaskDto> = emptyList(),
    val reminders: List<ReminderDto> = emptyList()
)

// Legacy fitness request kept for ApiService compatibility
@JsonClass(generateAdapter = true)
data class UpsertFitnessRequest(
    val date: String? = null,
    val weight: Double? = null,
    val height: Double? = null,
    val calories: Int? = null,
    val steps: Int? = null,
    val distanceKm: Double? = null,
    val activeMinutes: Int? = null
)

@JsonClass(generateAdapter = true)
data class CreateRoutineRequest(
    val name: String,
    val description: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val exercises: List<WorkoutExerciseDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkoutSessionDto(
    val id: String,
    val userId: String? = null,
    val name: String,
    val routineId: String? = null,
    val date: String = "",
    val durationMin: Int = 0,
    val calories: Int? = null,
    val notes: String? = null,
    val createdAt: Long = 0L,
    val sets: List<WorkoutSetDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkoutSetDto(
    val id: String? = null,
    val sessionId: String? = null,
    val exerciseName: String,
    val setNumber: Int = 1,
    val reps: Int = 0,
    val weightKg: Double = 0.0,
    val done: Boolean = false,
    val sortOrder: Int = 0
)

@JsonClass(generateAdapter = true)
data class CreateSessionRequest(
    val name: String,
    val routineId: String? = null,
    val date: String,
    val durationMin: Int = 0,
    val calories: Int? = null,
    val notes: String? = null,
    val sets: List<WorkoutSetDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WatchRoomDetailDto(
    val id: String,
    val name: String,
    val code: String = "",
    val hostId: String? = null,
    val videoUrl: String = "",
    val privacy: String = "public",
    val isActive: Boolean = true,
    val createdAt: Long = 0L,
    val participants: List<UserDto> = emptyList(),
    val messages: List<MessageDto> = emptyList()
)
