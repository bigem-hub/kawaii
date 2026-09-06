package com.kawaiilife.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.kawaiilife.app.feature.auth.*
import com.kawaiilife.app.feature.dashboard.DashboardScreen
import com.kawaiilife.app.feature.tasks.TasksScreen
import com.kawaiilife.app.feature.notes.NotesScreen
import com.kawaiilife.app.feature.chat.ChatListScreen
import com.kawaiilife.app.feature.chat.ChatScreen
import com.kawaiilife.app.feature.friends.FriendsScreen
import com.kawaiilife.app.feature.calendar.CalendarScreen
import com.kawaiilife.app.feature.fitness.FitnessScreen
import com.kawaiilife.app.feature.watch.WatchScreen
import com.kawaiilife.app.feature.profile.ProfileScreen
import com.kawaiilife.app.feature.stats.StatsScreen
import com.kawaiilife.app.feature.settings.SettingsScreen
import com.kawaiilife.app.feature.notifications.NotificationsScreen
import com.kawaiilife.app.ui.components.LoadingScreen
import com.kawaiilife.app.ui.theme.KawaiiLifeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KawaiiLifeTheme {
                KawaiiLifeApp()
            }
        }
    }
}

sealed class Screen(val route: String) {
    object Login    : Screen("login")
    object Register : Screen("register")
    object Dashboard: Screen("dashboard")
    object Tasks    : Screen("tasks")
    object Notes    : Screen("notes")
    object Chat     : Screen("chat")
    object ChatRoom : Screen("chat/{convId}") {
        fun route(id: String) = "chat/$id"
    }
    object Friends  : Screen("friends")
    object Calendar : Screen("calendar")
    object Fitness  : Screen("fitness")
    object Watch    : Screen("watch")
    object Profile  : Screen("profile")
    object Stats    : Screen("stats")
    object Settings : Screen("settings")
    object Notifications : Screen("notifications")
}

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val selectedIcon: androidx.compose.ui.graphics.vector.ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Dashboard.route, "Home",    Icons.Outlined.Home,        Icons.Filled.Home),
    BottomNavItem(Screen.Tasks.route,    "Tasks",   Icons.Outlined.CheckBox,    Icons.Filled.CheckBox),
    BottomNavItem(Screen.Chat.route,     "Chat",    Icons.Outlined.Chat,        Icons.Filled.Chat),
    BottomNavItem(Screen.Fitness.route,  "Fitness", Icons.Outlined.FitnessCenter, Icons.Filled.FitnessCenter),
    BottomNavItem(Screen.Friends.route,  "Friends", Icons.Outlined.Group,       Icons.Filled.Group),
)

@Composable
fun KawaiiLifeApp() {
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.authState.collectAsState()
    val navController = rememberNavController()

    when (authState) {
        is AuthState.Loading -> LoadingScreen("KawaiiLife is waking up...")

        is AuthState.Unauthenticated -> {
            NavHost(navController = navController, startDestination = Screen.Login.route) {
                composable(Screen.Login.route) {
                    LoginScreen(
                        viewModel = authViewModel,
                        onNavigateToRegister = { navController.navigate(Screen.Register.route) }
                    )
                }
                composable(Screen.Register.route) {
                    RegisterScreen(
                        viewModel = authViewModel,
                        onNavigateToLogin = { navController.popBackStack() }
                    )
                }
            }
        }

        is AuthState.Authenticated -> {
            MainAppScaffold(authViewModel = authViewModel)
        }
    }
}

@Composable
fun MainAppScaffold(authViewModel: AuthViewModel) {
    val navController = rememberNavController()
    val currentBackStack by navController.currentBackStackEntryAsState()
    val currentDestination = currentBackStack?.destination

    val showBottomBar = bottomNavItems.any { it.route == currentDestination?.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    tonalElevation = 0.dp,
                    containerColor = MaterialTheme.colorScheme.surface
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    if (selected) item.selectedIcon else item.icon,
                                    contentDescription = item.label
                                )
                            },
                            label = { Text(item.label) },
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onNavigateTo = { navController.navigate(it) }
                )
            }
            composable(Screen.Tasks.route) {
                TasksScreen()
            }
            composable(Screen.Notes.route) {
                NotesScreen()
            }
            composable(Screen.Chat.route) {
                ChatListScreen(
                    onOpenChat = { convId -> navController.navigate(Screen.ChatRoom.route(convId)) }
                )
            }
            composable(Screen.ChatRoom.route) { backStack ->
                val convId = backStack.arguments?.getString("convId") ?: return@composable
                ChatScreen(
                    conversationId = convId,
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Friends.route) {
                FriendsScreen()
            }
            composable(Screen.Calendar.route) {
                CalendarScreen()
            }
            composable(Screen.Fitness.route) {
                FitnessScreen()
            }
            composable(Screen.Watch.route) {
                WatchScreen()
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLogout = { authViewModel.logout() }
                )
            }
            composable("profile/{username}") { backStack ->
                val username = backStack.arguments?.getString("username") ?: return@composable
                ProfileScreen(username = username)
            }
            composable(Screen.Stats.route) {
                StatsScreen()
            }
            composable(Screen.Settings.route) {
                SettingsScreen()
            }
            composable(Screen.Notifications.route) {
                NotificationsScreen()
            }
        }
    }
}
