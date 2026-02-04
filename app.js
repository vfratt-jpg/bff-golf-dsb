// Golf Dashboard Application
class GolfDashboard {
    constructor() {
        this.tournaments = [];
        this.charts = {};
        this.retryCount = 0;
        this.maxRetries = 3;
        this.connectionStatus = 'online';
        this.init();
    }

    async init() {
        try {
            this.showConnectionStatus('online');
            await this.loadData();
            this.setupEventListeners();
            this.renderDashboard();
            this.setupServiceWorker();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleError(error);
        }
    }

    showConnectionStatus(status) {
        this.connectionStatus = status;
        let statusElement = document.querySelector('.connection-status');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'connection-status';
            document.body.appendChild(statusElement);
        }
        
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'online':
                statusElement.textContent = '🟢 Online';
                setTimeout(() => statusElement.style.display = 'none', 3000);
                break;
            case 'offline':
                statusElement.textContent = '🔴 Offline';
                statusElement.style.display = 'block';
                break;
            case 'reconnecting':
                statusElement.textContent = '🟡 Reconnecting...';
                statusElement.style.display = 'block';
                break;
        }
    }

    async loadData() {
        try {
            // Try to load from cache first
            const cachedData = this.getCachedData();
            if (cachedData) {
                this.tournaments = cachedData;
                console.log('Loaded data from cache');
                return;
            }

            // Fetch fresh data
            const response = await this.fetchWithRetry('./data/championships.json');
            this.tournaments = await response.json();
            
            // Cache the data
            this.setCachedData(this.tournaments);
            console.log('Loaded fresh data and cached it');
            
        } catch (error) {
            console.error('Failed to load data:', error);
            
            // Try to load from localStorage as fallback
            const fallbackData = this.getCachedData();
            if (fallbackData) {
                this.tournaments = fallbackData;
                this.showConnectionStatus('offline');
                console.log('Using cached data due to network error');
            } else {
                throw new Error('No data available');
            }
        }
    }

    async fetchWithRetry(url, options = {}) {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache',
                        ...options.headers
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                console.warn(`Fetch attempt ${i + 1} failed:`, error.message);
                
                if (i === this.maxRetries - 1) {
                    throw error;
                }
                
                // Exponential backoff
                await this.delay(Math.pow(2, i) * 1000);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getCachedData() {
        try {
            const cached = localStorage.getItem('golf-tournaments');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.warn('Failed to load cached data:', error);
            return null;
        }
    }

    setCachedData(data) {
        try {
            localStorage.setItem('golf-tournaments', JSON.stringify(data));
            localStorage.setItem('golf-tournaments-timestamp', Date.now().toString());
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('tournamentForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Modal close events
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('addTournamentModal');
            if (e.target === modal) {
                this.closeAddTournamentModal();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAddTournamentModal();
            }
        });

        // Online/offline detection
        window.addEventListener('online', () => {
            this.showConnectionStatus('online');
            this.refreshData();
        });

        window.addEventListener('offline', () => {
            this.showConnectionStatus('offline');
        });
    }

    async refreshData() {
        try {
            this.showConnectionStatus('reconnecting');
            await this.loadData();
            this.renderDashboard();
            this.showConnectionStatus('online');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showConnectionStatus('offline');
        }
    }

    renderDashboard() {
        this.updateStats();
        this.renderCharts();
        this.renderLeaderboard();
        this.renderRecentTournaments();
        this.renderTrophyCards();
    }

    updateStats() {
        const totalTournaments = this.tournaments.length;
        const uniqueChampions = [...new Set(this.tournaments.map(t => t.name))].length;
        
        // Find top champion
        const championCounts = {};
        this.tournaments.forEach(t => {
            championCounts[t.name] = (championCounts[t.name] || 0) + 1;
        });
        
        const topChampion = Object.entries(championCounts)
            .sort(([,a], [,b]) => b - a)[0];

        // Update DOM
        this.updateElement('totalTournaments', totalTournaments);
        this.updateElement('activeChampions', uniqueChampions);
        this.updateElement('topChampionCount', topChampion ? topChampion[1] : 0);
        this.updateElement('topChampionName', topChampion ? `${topChampion[0]} Titles` : 'No Data');
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    renderCharts() {
        this.renderTrophyDistributionChart();
        this.renderPerformanceChart();
    }

    renderTrophyDistributionChart() {
        const ctx = document.getElementById('trophyChart');
        if (!ctx) return;

        // Count trophies by type
        const trophyCounts = {};
        this.tournaments.forEach(t => {
            trophyCounts[t.trophy] = (trophyCounts[t.trophy] || 0) + 1;
        });

        // Destroy existing chart
        if (this.charts.trophyChart) {
            this.charts.trophyChart.destroy();
        }

        this.charts.trophyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(trophyCounts),
                datasets: [{
                    data: Object.values(trophyCounts),
                    backgroundColor: [
                        '#FFD700', '#8BC34A', '#FF5722', '#FF9800',
                        '#4CAF50', '#2196F3', '#9C27B0', '#795548'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    renderPerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        // Group tournaments by year and player
        const yearlyData = {};
        this.tournaments.forEach(t => {
            const year = new Date(t.date).getFullYear();
            if (!yearlyData[year]) yearlyData[year] = {};
            yearlyData[year][t.name] = (yearlyData[year][t.name] || 0) + 1;
        });

        // Get all unique players
        const players = [...new Set(this.tournaments.map(t => t.name))];
        const years = Object.keys(yearlyData).sort();

        // Create datasets for each player
        const datasets = players.map((player, index) => {
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
            ];
            
            return {
                label: player,
                data: years.map(year => yearlyData[year][player] || 0),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                tension: 0.4,
                fill: false
            };
        });

        // Destroy existing chart
        if (this.charts.performanceChart) {
            this.charts.performanceChart.destroy();
        }

        this.charts.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) return;

        // Count championships per player
        const championCounts = {};
        this.tournaments.forEach(t => {
            championCounts[t.name] = (championCounts[t.name] || 0) + 1;
        });

        // Sort by count
        const sortedChampions = Object.entries(championCounts)
            .sort(([,a], [,b]) => b - a);

        // Render leaderboard
        leaderboard.innerHTML = sortedChampions.map(([name, count], index) => `
            <li class="leaderboard-item">
                <div class="player-info">
                    <div class="player-rank">${index + 1}</div>
                    <div class="player-name">${name}</div>
                </div>
                <div class="player-titles">${count} ${count === 1 ? 'title' : 'titles'}</div>
            </li>
        `).join('');
    }

    renderRecentTournaments() {
        const container = document.getElementById('recentTournaments');
        if (!container) return;

        // Sort tournaments by date (most recent first)
        const recentTournaments = [...this.tournaments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        container.innerHTML = recentTournaments.map(t => `
            <div class="tournament-item">
                <div class="tournament-date">${this.formatDate(t.date)}</div>
                <div class="tournament-title">${t.trophy} Championship</div>
                <div class="tournament-details">
                    <strong>${t.name}</strong> - ${t.course} (${t.score})
                    ${t.history ? `<br><em>${t.history}</em>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderTrophyCards() {
        const trophyTypes = [
            { key: 'Petty Cup', id: 'pettyCup', name: 'Petty Cup' },
            { key: 'COW/UCOW', id: 'cowUcow', name: 'COW/UCOW' },
            { key: 'Paultz', id: 'paultz', name: 'Paultz' },
            { key: 'TAMC', id: 'tamc', name: 'TAMC' },
            { key: 'COW', id: 'cow', name: 'COW' },
            { key: 'SUC', id: 'suc', name: 'SUC' },
            { key: 'UCOW', id: 'ucow', name: 'UCOW' },
            { key: 'Brycehurst', id: 'brycehurst', name: 'Brycehurst' }
        ];

        trophyTypes.forEach(trophy => {
            this.renderTrophyCard(trophy);
        });
    }

    renderTrophyCard(trophy) {
        // Filter tournaments for this trophy type
        const trophyTournaments = this.tournaments.filter(t => t.trophy === trophy.key);
        
        // Update total count
        const totalElement = document.getElementById(`${trophy.id}Total`);
        if (totalElement) {
            totalElement.textContent = trophyTournaments.length;
        }

        // Render chart
        this.renderTrophyChart(trophy.id, trophyTournaments, trophy.name);
    }

    renderTrophyChart(chartId, tournaments, trophyName) {
        const ctx = document.getElementById(`${chartId}Chart`);
        if (!ctx || tournaments.length === 0) return;

        // Count wins per player
        const playerCounts = {};
        tournaments.forEach(t => {
            playerCounts[t.name] = (playerCounts[t.name] || 0) + 1;
        });

        // Sort by count
        const sortedPlayers = Object.entries(playerCounts)
            .sort(([,a], [,b]) => b - a);

        // Destroy existing chart
        if (this.charts[`${chartId}Chart`]) {
            this.charts[`${chartId}Chart`].destroy();
        }

        this.charts[`${chartId}Chart`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedPlayers.map(([name]) => name.split(' ')[0]), // First name only
                datasets: [{
                    label: `${trophyName} Wins`,
                    data: sortedPlayers.map(([, count]) => count),
                    backgroundColor: '#4CAF50',
                    borderColor: '#2E7D32',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    handleError(error) {
        console.error('Dashboard error:', error);
        
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `
            <h3>⚠️ Unable to Load Dashboard</h3>
            <p>There was a problem loading the tournament data. Please check your connection and try again.</p>
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(errorDiv);
        }
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('service-worker.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    }

    // Modal functions
    openAddTournamentModal() {
        const modal = document.getElementById('addTournamentModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeAddTournamentModal() {
        const modal = document.getElementById('addTournamentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Reset form
        const form = document.getElementById('tournamentForm');
        if (form) {
            form.reset();
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const newTournament = {
            name: formData.get('playerName'),
            date: formData.get('tournamentDate'),
            trophy: formData.get('trophyType'),
            course: formData.get('courseName'),
            score: parseInt(formData.get('score')),
            history: formData.get('history') || ''
        };

        // Add to tournaments array
        this.tournaments.push(newTournament);
        
        // Update cache
        this.setCachedData(this.tournaments);
        
        // Re-render dashboard
        this.renderDashboard();
        
        // Close modal
        this.closeAddTournamentModal();
        
        // Show success message
        this.showSuccessMessage('Tournament added successfully!');
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    exportData() {
        const dataStr = JSON.stringify(this.tournaments, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `golf-championships-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }
}

// Global functions for HTML onclick handlers
function openAddTournamentModal() {
    if (window.dashboard) {
        window.dashboard.openAddTournamentModal();
    }
}

function closeAddTournamentModal() {
    if (window.dashboard) {
        window.dashboard.closeAddTournamentModal();
    }
}

function exportData() {
    if (window.dashboard) {
        window.dashboard.exportData();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new GolfDashboard();
});

// Handle page visibility changes for battery optimization
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations and reduce activity when page is hidden
        console.log('Page hidden - reducing activity');
    } else {
        // Resume normal activity when page is visible
        console.log('Page visible - resuming activity');
        if (window.dashboard) {
            window.dashboard.refreshData();
        }
    }
});
Add enhanced JavaScript application logic
