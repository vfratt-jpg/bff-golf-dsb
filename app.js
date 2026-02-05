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

        const colors = [
            '#FFD700', '#4CAF50', '#FF9800', '#2196F3', 
            '#9C27B0', '#FF5722', '#795548', '#607D8B'
        ];

        this.charts.trophyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(trophyCounts),
                datasets: [{
                    data: Object.values(trophyCounts),
                    backgroundColor: colors.slice(0, Object.keys(trophyCounts).length),
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
                            padding: 0"color:#005CC5">15,
                            usePointStyle: true,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                return data.labels.map((label, i) => {
                                    const count = data.datasets[0].data[i];
                                    return {
                                        text: `${label} (${count})`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].borderColor,
                                        lineWidth: data.datasets[0].borderWidth,
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                });
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

        // Calculate total wins for each player
        const playerTotals = {};
        this.tournaments.forEach(t => {
            playerTotals[t.name] = (playerTotals[t.name] || 0) + 1;
        });

        // Create datasets for each player
        const datasets = players.map((player, index) => {
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
            ];
            
            return {
                label: `${player} (${playerTotals[player]})`,
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
                            padding: 0"color:#005CC5">15,
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
                <div class="player-titles">${count} titles</div>
            </li>
        `).join('');
    }

    renderRecentTournaments() {
        const container = document.getElementById('recentTournaments');
        if (!container) return;

        // Sort tournaments by date (most recent first)
        const recentTournaments = [...this.tournaments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        container.innerHTML = recentTournaments.map(tournament => `
            <div class="tournament-item">
                <div class="tournament-date">${this.formatDate(tournament.date)}</div>
                <div class="tournament-title">${tournament.name} - ${tournament.trophy}</div>
                <div class="tournament-details">
                    ${tournament.course} | Score: ${tournament.score}
                    ${tournament.history ? `<br><em>${tournament.history}</em>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderTrophyCards() {
        const trophyTypes = ['Petty Cup', 'COW/UCOW', 'Paultz', 'TAMC', 'COW', 'SUC', 'UCOW', 'Brycehurst'];
        
        trophyTypes.forEach(trophyType => {
            this.renderIndividualTrophyCard(trophyType);
        });
    }

    renderIndividualTrophyCard(trophyType) {
        const trophyData = this.tournaments.filter(t => t.trophy === trophyType);
        
        if (trophyData.length === 0) return;

        // Count winners
        const winnerCounts = {};
        trophyData.forEach(t => {
            winnerCounts[t.name] = (winnerCounts[t.name] || 0) + 1;
        });

        // Update total count
        const totalElement = document.getElementById(this.getTrophyTotalId(trophyType));
        if (totalElement) {
            totalElement.textContent = `${trophyData.length}`;
        }

        // Render chart
        const chartId = this.getTrophyChartId(trophyType);
        const canvas = document.getElementById(chartId);
        if (canvas) {
            this.createTrophyChart(chartId, winnerCounts, trophyType);
        }
    }

    getTrophyTotalId(trophy) {
        const idMap = {
            'Petty Cup': 'pettyCupTotal',
            'COW/UCOW': 'cowUcowTotal',
            'Paultz': 'paultzTotal',
            'TAMC': 'tamcTotal',
            'COW': 'cowTotal',
            'SUC': 'sucTotal',
            'UCOW': 'ucowTotal',
            'Brycehurst': 'brycehurstTotal'
        };
        return idMap[trophy];
    }

    getTrophyChartId(trophy) {
        const idMap = {
            'Petty Cup': 'pettyCupChart',
            'COW/UCOW': 'cowUcowChart',
            'Paultz': 'paultzChart',
            'TAMC': 'tamcChart',
            'COW': 'cowChart',
            'SUC': 'sucChart',
            'UCOW': 'ucowChart',
            'Brycehurst': 'brycehurstChart'
        };
        return idMap[trophy];
    }

    createTrophyChart(chartId, winnerCounts, trophyType) {
        const ctx = document.getElementById(chartId);
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }

        const sortedWinners = Object.entries(winnerCounts)
            .sort(([,a], [,b]) => b - a);

        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ];

        this.charts[chartId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sortedWinners.map(([name]) => name),
                datasets: [{
                    data: sortedWinners.map(([, count]) => count),
                    backgroundColor: colors.slice(0, sortedWinners.length),
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
                            padding: 0"color:#005CC5">8,
                            usePointStyle: true,
                            font: {
                                size: 10
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const count = data.datasets[0].data[i];
                                        return {
                                            text: `${label} (${count})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} wins (${percentage}%)`;
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
            month: 'long',
            day: 'numeric'
        });
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    handleError(error) {
        console.error('Dashboard error:', error);
        
        // Show user-friendly error message
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.innerHTML = `
            <div class="error-content">
                <h3>⚠️ Unable to Load Dashboard</h3>
                <p>There was a problem loading the championship data. Please check your internet connection and try refreshing the page.</p>
                <button onclick="location.reload()" class="btn btn-primary">Refresh Page</button>
            </div>
        `;
        
        document.body.appendChild(errorContainer);
    }

    // Modal functions
    openAddTournamentModal() {
        const modal = document.getElementById('addTournamentModal');
        if (modal) {
            modal.style.display = 'block';
            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('tournamentDate').value = today;
        }
    }

    closeAddTournamentModal() {
        const modal = document.getElementById('addTournamentModal');
        if (modal) {
            modal.style.display = 'none';
            // Reset form
            const form = document.getElementById('tournamentForm');
            if (form) form.reset();
        }
    }

    handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const newTournament = {
            name: formData.get('playerName'),
            date: formData.get('tournamentDate'),
            trophy: formData.get('trophyType'),
            course: formData.get('courseName'),
            score: parseInt(formData.get('score')),
            history: formData.get('history') || ''
        };

        // Add to tournaments array
        this.tournaments.unshift(newTournament);
        
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
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    exportData() {
        try {
            const dataStr = JSON.stringify(this.tournaments, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `golf_championships_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export data. Please try again.');
        }
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;

document.addEventListener('DOMContentLoaded', function() {
    dashboard = new GolfDashboard();
});

// Global functions for HTML onclick handlers
function openAddTournamentModal() {
    if (dashboard) dashboard.openAddTournamentModal();
}

function closeAddTournamentModal() {
    if (dashboard) dashboard.closeAddTournamentModal();
}

function exportData() {
    if (dashboard) dashboard.exportData();
}
