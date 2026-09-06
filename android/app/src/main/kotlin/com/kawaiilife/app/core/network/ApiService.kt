package com.kawaiilife.app.core.network

import com.kawaiilife.app.data.model.*
import retrofit2.http.*

interface ApiService {

    // ── Auth ─────────────────────────────────────────────────────────────────
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @GET("auth/me")
    suspend fun getMe(): MeResponse

    @GET("auth/me")
    suspend fun getMyProfile(): UserProfileDto

    @POST("auth/logout")
    suspend fun logout(): SuccessResponse

    @PATCH("auth/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): UserProfileDto

    @PATCH("auth/settings")
    suspend fun updateSettings(@Body body: Map<String, @JvmSuppressWildcards Any>): SuccessResponse

    // ── Dashboard ────────────────────────────────────────────────────────────
    @GET("dashboard")
    suspend fun getDashboard(): DashboardDto

    // ── Tasks ────────────────────────────────────────────────────────────────
    @GET("tasks")
    suspend fun getTasks(
        @Query("status") status: String? = null,
        @Query("category") category: String? = null,
        @Query("priority") priority: String? = null,
        @Query("search") search: String? = null,
        @Query("view") view: String? = null
    ): List<TaskDto>

    @GET("tasks/stats")
    suspend fun getTaskStats(): TaskStatsDto

    @POST("tasks")
    suspend fun createTask(@Body body: CreateTaskRequest): TaskDto

    @PATCH("tasks/{id}")
    suspend fun updateTask(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards Any?>): TaskDto

    @DELETE("tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): SuccessResponse

    @POST("tasks/{id}/subtasks")
    suspend fun createSubtask(@Path("id") taskId: String, @Body body: Map<String, String>): SubtaskDto

    @PATCH("tasks/{id}/subtasks/{subId}")
    suspend fun updateSubtask(
        @Path("id") taskId: String,
        @Path("subId") subtaskId: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): SubtaskDto

    @DELETE("tasks/{id}/subtasks/{subId}")
    suspend fun deleteSubtask(@Path("id") taskId: String, @Path("subId") subtaskId: String): SuccessResponse

    @GET("tasks/categories")
    suspend fun getCategories(): List<CategoryDto>

    @POST("tasks/categories")
    suspend fun createCategory(@Body body: CreateCategoryRequest): CategoryDto

    @PATCH("tasks/categories/{id}")
    suspend fun updateCategory(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards Any>): CategoryDto

    @DELETE("tasks/categories/{id}")
    suspend fun deleteCategory(@Path("id") id: String): SuccessResponse

    // ── Notes ────────────────────────────────────────────────────────────────
    @GET("notes")
    suspend fun getNotes(
        @Query("archived") archived: Boolean? = null,
        @Query("search") search: String? = null,
        @Query("pinned") pinned: Boolean? = null,
        @Query("type") type: String? = null
    ): List<NoteDto>

    @GET("notes/shared")
    suspend fun getSharedNotes(): List<NoteDto>

    @GET("notes/{id}")
    suspend fun getNote(@Path("id") id: String): NoteDto

    @POST("notes")
    suspend fun createNote(@Body body: CreateNoteRequest): NoteDto

    @PATCH("notes/{id}")
    suspend fun updateNote(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards Any?>): NoteDto

    @DELETE("notes/{id}")
    suspend fun deleteNote(@Path("id") id: String): SuccessResponse

    @POST("notes/{id}/comments")
    suspend fun addNoteComment(@Path("id") noteId: String, @Body body: Map<String, String>): NoteCommentDto

    // ── Friends ──────────────────────────────────────────────────────────────
    @GET("friends")
    suspend fun getFriends(): List<FriendDto>

    @GET("friends/requests")
    suspend fun getFriendRequests(): List<FriendRequestDto>

    @GET("friends/search")
    suspend fun searchUsers(@Query("q") query: String): List<UserDto>

    @POST("friends/request")
    suspend fun sendFriendRequest(@Body body: Map<String, String>): SuccessResponse

    @POST("friends/accept/{id}")
    suspend fun acceptFriendRequest(@Path("id") id: String): SuccessResponse

    @POST("friends/reject/{id}")
    suspend fun declineFriendRequest(@Path("id") id: String): SuccessResponse

    @DELETE("friends/{id}")
    suspend fun removeFriend(@Path("id") id: String): SuccessResponse

    @GET("friends/socials")
    suspend fun getSocialLinks(): List<SocialLinkDto>

    @POST("friends/socials")
    suspend fun addSocialLink(@Body body: CreateSocialLinkRequest): SocialLinkDto

    @DELETE("friends/socials/{id}")
    suspend fun deleteSocialLink(@Path("id") id: String): SuccessResponse

    // ── Chat ─────────────────────────────────────────────────────────────────
    @GET("chat/conversations")
    suspend fun getConversations(): List<ConversationDto>

    @POST("chat/direct")
    suspend fun getOrCreateDirect(@Body body: Map<String, String>): ConversationDto

    @POST("chat/group")
    suspend fun createGroup(@Body body: CreateGroupRequest): ConversationDto

    @GET("chat/{convId}/messages")
    suspend fun getMessages(@Path("convId") convId: String): List<MessageDto>

    @POST("chat/{convId}/messages")
    suspend fun sendMessage(@Path("convId") convId: String, @Body body: SendMessageRequest): MessageDto

    @PATCH("chat/messages/{id}")
    suspend fun editMessage(@Path("id") id: String, @Body body: Map<String, String>): MessageDto

    @DELETE("chat/messages/{id}")
    suspend fun deleteMessage(@Path("id") id: String): SuccessResponse

    @POST("chat/messages/{id}/react")
    suspend fun reactToMessage(@Path("id") id: String, @Body body: Map<String, String>): SuccessResponse

    // ── Calendar ─────────────────────────────────────────────────────────────
    @GET("calendar/combined")
    suspend fun getCalendarCombined(): CalendarCombinedDto

    @GET("calendar/events")
    suspend fun getEvents(
        @Query("year") year: Int? = null,
        @Query("month") month: Int? = null
    ): List<EventDto>

    @POST("calendar/events")
    suspend fun createEvent(@Body body: CreateEventRequest): EventDto

    @PATCH("calendar/events/{id}")
    suspend fun updateEvent(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards Any?>): EventDto

    @DELETE("calendar/events/{id}")
    suspend fun deleteEvent(@Path("id") id: String): SuccessResponse

    @GET("calendar/reminders")
    suspend fun getReminders(): List<ReminderDto>

    @POST("calendar/reminders")
    suspend fun createReminder(@Body body: CreateReminderRequest): ReminderDto

    @DELETE("calendar/reminders/{id}")
    suspend fun deleteReminder(@Path("id") id: String): SuccessResponse

    // ── Fitness ───────────────────────────────────────────────────────────────
    @GET("fitness")
    suspend fun getFitnessEntries(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("limit") limit: Int? = null
    ): List<FitnessEntryDto>

    @POST("fitness")
    suspend fun upsertFitnessEntry(@Body body: UpsertFitnessRequest): FitnessEntryDto

    @POST("fitness/exercises")
    suspend fun createFitnessEntry(@Body body: CreateFitnessEntryRequest): FitnessEntryDto

    @DELETE("fitness/exercises/{id}")
    suspend fun deleteFitnessEntry(@Path("id") id: String): SuccessResponse

    @GET("fitness/cardio")
    suspend fun getCardioEntries(): List<CardioEntryDto>

    @POST("fitness/cardio")
    suspend fun createCardioEntry(@Body body: CreateCardioEntryRequest): CardioEntryDto

    @DELETE("fitness/cardio/{id}")
    suspend fun deleteCardioEntry(@Path("id") id: String): SuccessResponse

    @GET("fitness/routines")
    suspend fun getWorkoutRoutines(): List<WorkoutRoutineDto>

    @POST("fitness/routines")
    suspend fun createRoutine(@Body body: CreateRoutineRequest): WorkoutRoutineDto

    @DELETE("fitness/routines/{id}")
    suspend fun deleteRoutine(@Path("id") id: String): SuccessResponse

    @GET("fitness/sessions")
    suspend fun getSessions(): List<WorkoutSessionDto>

    @POST("fitness/sessions")
    suspend fun createSession(@Body body: CreateSessionRequest): WorkoutSessionDto

    @DELETE("fitness/sessions/{id}")
    suspend fun deleteSession(@Path("id") id: String): SuccessResponse

    @GET("fitness/stats")
    suspend fun getFitnessStats(): FitnessStatsDto

    // ── Watch Party ───────────────────────────────────────────────────────────
    @GET("watch/rooms")
    suspend fun getWatchRooms(): List<WatchRoomDto>

    @POST("watch/rooms")
    suspend fun createWatchRoom(@Body body: CreateWatchRoomRequest): WatchRoomDto

    @POST("watch/rooms/{id}/join")
    suspend fun joinWatchRoom(@Path("id") id: String): WatchRoomDto

    @GET("watch/rooms/{id}")
    suspend fun getWatchRoom(@Path("id") id: String): WatchRoomDetailDto

    @POST("watch/rooms/{id}/leave")
    suspend fun leaveWatchRoom(@Path("id") id: String): SuccessResponse

    @POST("watch/rooms/{id}/messages")
    suspend fun sendWatchRoomMessage(@Path("id") id: String, @Body body: SendMessageRequest): MessageDto

    // ── Notifications ─────────────────────────────────────────────────────────
    @GET("notifications")
    suspend fun getNotifications(): List<NotificationDto>

    @GET("notifications/unread-count")
    suspend fun getUnreadCount(): UnreadCountDto

    @POST("notifications/read-all")
    suspend fun markAllNotificationsRead(): SuccessResponse

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): SuccessResponse

    @GET("notifications/achievements")
    suspend fun getAchievements(): List<AchievementDto>

    // ── Users / Search ────────────────────────────────────────────────────────
    @GET("users/{username}")
    suspend fun getUserProfile(@Path("username") username: String): UserProfileDto

    @GET("search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String? = null
    ): SearchResultsDto
}
