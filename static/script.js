$(document).ready(function() {
    let singleLotChart;
    let overallHistoryChart;

    // --- THEME TOGGLE LOGIC ---
    const getPreferredTheme = () => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        $('#theme-toggle-switch').prop('checked', theme === 'dark');
        // Re-render chart with new theme colors
        if (overallHistoryChart) {
            fetchAndRenderOverallHistoryChart();
        }
    };

    setTheme(getPreferredTheme());

    $('#theme-toggle-switch').on('change', function() {
        setTheme(this.checked ? 'dark' : 'light');
    });
    // --- END THEME LOGIC ---


    // --- CHART OPTIONS (DYNAMIC) ---
    const getChartOptions = () => {
        const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const textColor = isDarkMode ? '#e0e0e0' : '#333';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { position: 'nearest' }, legend: { labels: { color: textColor, font: { weight: 'bold' } } } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Total Vehicle Count', color: textColor, font: { weight: 'bold' } }, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { type: 'time', time: { unit: 'hour', tooltipFormat: 'MMM d, h:mm a', displayFormats: { hour: 'h a' } }, ticks: { color: textColor }, grid: { color: gridColor } }
            }
        };
    };

    const getSingleLotChartOptions = () => {
        const baseOptions = getChartOptions();
        baseOptions.scales.y.title.text = 'Occupancy (%)';
        baseOptions.scales.y.max = 100;
        baseOptions.scales.x.title = { display: true, text: 'Time', color: baseOptions.scales.x.ticks.color, font: { weight: 'bold' } };
        return baseOptions;
    }
    // --- END CHART OPTIONS ---

    function createParkingCard(lot) {
        const occupancyPercent = lot.Occupancy_Percent;
        let progressBarColor = 'bg-success';
        if (occupancyPercent > 85) progressBarColor = 'bg-danger';
        else if (occupancyPercent > 50) progressBarColor = 'bg-warning';
        
        const statusText = lot.IsParkingAvailable ? 'Available' : 'Closed';
        const statusClass = lot.IsParkingAvailable ? 'status-available' : 'status-unavailable';
        const btnClass = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'btn-outline-light' : 'btn-outline-secondary';

        const buttonGroup = `
            <div class="d-flex align-items-center">
                <div class="btn-group" role="group">
                    <a href="${lot.Location_Link}" target="_blank" class="btn btn-sm ${btnClass}" title="Location"><i class="bi bi-geo-alt"></i></a>
                    <a href="${lot.Photos_Link}" target="_blank" class="btn btn-sm ${btnClass}" title="Photos"><i class="bi bi-camera"></i></a>
                    <button class="btn btn-sm ${btnClass} view-history-btn" data-bs-toggle="modal" data-bs-target="#lotHistoryModal" title="View History" data-parking-id="${lot.ParkingLotID}"><i class="bi bi-clock-history"></i></button>
                </div>
            </div>`;

        return `
            <div class="col-md-6">
                <div class="card parking-card h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold parking-name flex-grow-1 me-2">${lot.Parking_name_en}</span>
                            <span class="availability-status ${statusClass}">${statusText}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="card-title text-secondary-dynamic mb-1">Occupancy: ${lot.Current_Vehicle}/${lot.TotalCapacity}</h6>
                            ${buttonGroup}
                        </div>
                        <div class="progress mt-2" role="progressbar" style="height: 18px;">
                            <div class="progress-bar ${progressBarColor} fw-bold" style="width: ${occupancyPercent}%;">${Math.round(occupancyPercent)}%</div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function updateRouteProgressBar(routeName, current, total) {
        const percent = total > 0 ? (current / total) * 100 : 0;
        let progressBarColor = 'bg-success';
        if (percent > 85) progressBarColor = 'bg-danger';
        else if (percent > 50) progressBarColor = 'bg-warning';
        $(`#${routeName.toLowerCase()}-route-progress`).css('width', percent + '%').text(Math.round(percent) + '%').removeClass('bg-success bg-warning bg-danger').addClass(progressBarColor);
        $(`#${routeName.toLowerCase()}-route-count`).text(`${current} / ${total}`);
    }

    function fetchAndRenderData() {
        $.getJSON('/api/parking-data', function(response) {
            const lots = response.data;
            $('#last-updated').text(new Date(response.last_updated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }));
            
            let totalCurrentVehicles = 0, totalOverallCapacity = 0;
            const routeStats = { 'Thoothukudi': { current: 0, total: 0 }, 'Tirunelveli': { current: 0, total: 0 }, 'Nagercoil': { current: 0, total: 0 } };

            lots.forEach(lot => {
                totalCurrentVehicles += lot.Current_Vehicle;
                totalOverallCapacity += lot.TotalCapacity;
                if (routeStats[lot.Route_en]) {
                    routeStats[lot.Route_en].current += lot.Current_Vehicle;
                    routeStats[lot.Route_en].total += lot.TotalCapacity;
                }
            });

            const overallOccupancyPercent = totalOverallCapacity > 0 ? (totalCurrentVehicles / totalOverallCapacity) * 100 : 0;
            $('#overall-progress-bar').css('width', overallOccupancyPercent + '%').text(Math.round(overallOccupancyPercent) + '%');
            $('#total-vehicles').text(totalCurrentVehicles.toLocaleString());
            $('#total-capacity').text(totalOverallCapacity.toLocaleString());

            for (const routeName in routeStats) {
                updateRouteProgressBar(routeName, routeStats[routeName].current, routeStats[routeName].total);
            }

            const thoothukudiLots = lots.filter(lot => lot.Route_en === 'Thoothukudi').sort((a, b) => b.Occupancy_Percent - a.Occupancy_Percent);
            const tirunelveliLots = lots.filter(lot => lot.Route_en === 'Tirunelveli').sort((a, b) => b.Occupancy_Percent - a.Occupancy_Percent);
            const nagercoilLots = lots.filter(lot => lot.Route_en === 'Nagercoil').sort((a, b) => b.Occupancy_Percent - a.Occupancy_Percent);

            $('#thoothukudi-lots-container').html(thoothukudiLots.map(createParkingCard).join(''));
            $('#tirunelveli-lots-container').html(tirunelveliLots.map(createParkingCard).join(''));
            $('#nagercoil-lots-container').html(nagercoilLots.map(createParkingCard).join(''));
        });
    }

    function fetchAndRenderOverallHistoryChart() {
        $.getJSON('/api/overall-history', function(data) {
            if (overallHistoryChart) overallHistoryChart.destroy();
            overallHistoryChart = new Chart(document.getElementById('overallHistoryChart').getContext('2d'), {
                type: 'line',
                data: { datasets: data.datasets },
                options: getChartOptions()
            });
        });
    }

    $('#lotHistoryModal').on('show.bs.modal', function(event) {
        const parkingLotID = event.relatedTarget.getAttribute('data-parking-id');
        $('#modal-loading-text').show();
        $('#singleLotChart').hide();
        if (singleLotChart) singleLotChart.destroy();

        $.getJSON(`/api/parking-lot-history?id=${parkingLotID}`, function(data) {
            $('#lotHistoryModalLabel').text(`Last 24-Hour History for ${data.lotName}`);
            $('#modal-loading-text').hide();
            $('#singleLotChart').show();
            singleLotChart = new Chart(document.getElementById('singleLotChart').getContext('2d'), {
                type: 'line',
                data: { datasets: data.datasets },
                options: getSingleLotChartOptions()
            });
        }).fail(function() { $('#lotHistoryModalLabel').text('Error'); $('#modal-loading-text').text('Could not load historical data.'); });
    });

    fetchAndRenderData();
    fetchAndRenderOverallHistoryChart();
    
    setInterval(fetchAndRenderData, 60 * 1000);
    setInterval(fetchAndRenderOverallHistoryChart, 5 * 60 * 1000);
});
