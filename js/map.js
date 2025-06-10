document.addEventListener("DOMContentLoaded", function () {
    const map = L.map("map", {
        zoomControl: false  // Disable zoom control buttons
    }).setView([36.2977, 59.6057], 13); // Mashhad

    // Add zoom control event listeners
    document.getElementById('map-zoom-in').addEventListener('click', function() {
        map.zoomIn(1);
    });

    document.getElementById('map-zoom-out').addEventListener('click', function() {
        map.zoomOut(1);
    });

    // Clear search input on page load
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    // Reset map view when popup is closed
    map.on('popupclose', function() {
        map.setView([36.2977, 59.6057], 13); // Reset to Mashhad view
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let allSchools = [];
    let markers = [];
    let zonePolygons = {};
    let courseMap = {};
    let activeZoneId = null;

    let activeFilters = {
        gender_specific_code: [],
        technical_or_vocational_code: [],
        public_or_private_code: [],
        selectedCourse: null,
        selectedZone: null,
        searchText: ""
    };

    // Credits Modal Functionality
    const modal = document.getElementById("credits-modal");
    const btn = document.getElementById("credits-btn");
    const closeBtn = document.querySelector(".close-modal");

    btn.onclick = function() {
        modal.style.display = "flex";
    }

    closeBtn.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    function highlightZone(zoneId) {
        // Reset previous highlight
        if (activeZoneId && zonePolygons[activeZoneId]) {
            zonePolygons[activeZoneId].setStyle({
                weight: 2,
                fillOpacity: 0.1
            });
        }

        // Set new highlight
        if (zoneId && zonePolygons[zoneId]) {
            zonePolygons[zoneId].setStyle({
                weight: 5,
                fillOpacity: 0.3
            });
            zonePolygons[zoneId].bringToFront();
            activeZoneId = zoneId;
        } else {
            activeZoneId = null;
        }
    }

    // تابع تبدیل اعداد انگلیسی به فارسی
    function toPersianNum(num) {
        if (!num) return '';
        const persian = { 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' };
        return num.toString().replace(/[0-9]/g, c => persian[c]);
    }

    function addMarkers(filteredSchools) {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    
        const isMobile = window.innerWidth <= 768;
        const iconSize = isMobile ? [50, 50] : [70, 70];
    
        filteredSchools.forEach(school => {
            const lat = parseFloat(school.latitude);
            const lng = parseFloat(school.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
    
            const districtId = school.district;
    
            const icon = L.icon({
                iconUrl: `image/${districtId}-${school.gender_specific_code}.svg`,
                iconSize: iconSize
            });
    
            const courseCodes = Array.isArray(school.cources)
                ? school.cources
                : typeof school.cources === "string"
                ? school.cources.split(",")
                : [];
    
            const courseNames = courseCodes
                .map(code => code.trim())
                .filter(code => code)
                .map(code => courseMap[code] || code)
                .join("، ");
    
            const popup = `
                <div class="popup">
                    هنرستان <b style="color: #33358a;">${school.school_name}</b> - ${school.districtN || ""}<br>
                    ${school.technical_or_vocational}، ${school.gender_specific}، ${school.public_or_private}<br>
                    <b>رشته‌های فعال: </b>${courseNames}<br>
                    <b>نشانی: </b>${school.address || ""}<br>
                    <b>تلفن: </b>${toPersianNum(school.tel) || ""}
                </div>
            `;
    
            const marker = L.marker([lat, lng], { icon })
                .addTo(map)
                .bindPopup(popup)
                .on('click', function() {
                    highlightZone(school.district);
                    // در موبایل، زوم کمتری انجام می‌دهیم
                    const zoomLevel = isMobile ? 15 : 17;
                    map.setView([lat, lng], zoomLevel);
                });
            
            markers.push(marker);
        });
    }
    

    function fuzzyMatch(text, keyword) {
        if (!text || !keyword) return false;
        text = text.toLowerCase();
        keyword = keyword.toLowerCase();
        return text.includes(keyword);
    }

    function applyFilters() {
        let filtered = [...allSchools];

        // Apply search filter
        const searchQuery = activeFilters.searchText.trim();
        if (searchQuery) {
            filtered = filtered.filter(school => 
                fuzzyMatch(school.school_name || "", searchQuery) || 
                fuzzyMatch(school.address || "", searchQuery) ||
                (school.cources || []).some(code => {
                    const courseName = courseMap[code] || "";
                    return fuzzyMatch(code, searchQuery) || fuzzyMatch(courseName, searchQuery);
                })
            );
        }

        // Apply zone filter
        if (activeFilters.selectedZone) {
            filtered = filtered.filter(s => s.district === activeFilters.selectedZone);
        }

        // Apply course filter
        if (activeFilters.selectedCourse) {
            filtered = filtered.filter(s => {
                const courseCodes = Array.isArray(s.cources)
                    ? s.cources
                    : typeof s.cources === "string"
                    ? s.cources.split(",")
                    : [];
                return courseCodes.map(c => c.trim()).includes(activeFilters.selectedCourse);
            });
        }

        // Apply other filters
        filtered = filtered.filter(s =>
            (activeFilters.gender_specific_code.length === 0 || activeFilters.gender_specific_code.includes(s.gender_specific_code)) &&
            (activeFilters.technical_or_vocational_code.length === 0 || activeFilters.technical_or_vocational_code.includes(s.technical_or_vocational_code)) &&
            (activeFilters.public_or_private_code.length === 0 || activeFilters.public_or_private_code.includes(s.public_or_private_code))
        );

        // Update markers
        addMarkers(filtered);

        // تنظیم زوم نقشه
        const isMobileView = window.innerWidth <= 768;
        const padding = isMobileView ? [20, 20] : [50, 50];
        const defaultZoom = isMobileView ? 11 : 12;

        if (activeFilters.selectedZone === null) {
            // اگر "تمامی نواحی" انتخاب شده
            map.setView([36.2977, 59.6057], defaultZoom, { animate: true, duration: 1 });
        } else if (filtered.length > 0) {
            // اگر مدارس فیلتر شده وجود دارند
            const bounds = L.latLngBounds(filtered.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]));
            map.fitBounds(bounds, {
                padding: padding,
                maxZoom: isMobileView ? 14 : 15,
                animate: true,
                duration: 1
            });
        } else if (activeFilters.selectedZone) {
            // اگر فقط ناحیه انتخاب شده و مدرسه‌ای با فیلترهای فعلی وجود ندارد
            const selectedPolygon = zonePolygons[activeFilters.selectedZone];
            if (selectedPolygon) {
                const bounds = selectedPolygon.getBounds();
                map.fitBounds(bounds, {
                    padding: padding,
                    maxZoom: isMobileView ? 13 : 14,
                    animate: true,
                    duration: 1
                });
            }
        }
    }

    // بارگذاری فایل‌ها
    fetch("js/SchoolFilesIndex.json")
        .then(res => res.json())
        .then(schoolFileNames => {
            const schoolFetches = schoolFileNames.map(name =>
                fetch(`js/SchoolJson//${name}`).then(res => res.json())
            );

            return Promise.all([
                ...schoolFetches,
                fetch("js/cources.json").then(res => res.json())
            ]);
        })
        .then(allData => {
            const courseData = allData.pop();
            const schoolDataList = allData;
        
            allSchools = schoolDataList.flatMap(data => {
                const key = Object.keys(data)[0];
                return data[key];
            });
        
            // Initialize course map
            courseMap = {};
            Object.values(courseData).flat().forEach(c => {
                courseMap[c.code] = c.name;
            });

            // Initialize search functionality
            const searchInput = document.getElementById("searchInput");
            if (searchInput) {
                let searchTimeout;
                let typingTimeout;

                searchInput.addEventListener("focus", function() {
                    this.classList.add('typing');
                });

                searchInput.addEventListener("blur", function() {
                    this.classList.remove('typing');
                });

                searchInput.addEventListener("input", function() {
                    clearTimeout(searchTimeout);
                    clearTimeout(typingTimeout);
                    
                    // Reset typing animation
                    this.classList.remove('typing');
                    void this.offsetWidth; // Trigger reflow
                    this.classList.add('typing');
                    
                    // Clear typing class after 1 second of no input
                    typingTimeout = setTimeout(() => {
                        this.classList.remove('typing');
                    }, 1000);
                    
                    searchTimeout = setTimeout(() => {
                        activeFilters.searchText = this.value;
                        applyFilters();
                    }, 300);
                });

                // Auto-focus search on click
                searchInput.addEventListener("click", function() {
                    this.focus();
                });
            }

            //   مرحله ۱: جمع‌آوری کد رشته‌هایی که در هنرستان‌ها استفاده شده‌اند
            const usedCourseCodes = new Set();
            allSchools.forEach(s => {
                let codes = Array.isArray(s.cources)
                    ? s.cources
                    : typeof s.cources === "string"
                    ? s.cources.split(",")
                    : [];
        
                codes.map(c => c.trim()).filter(c => c).forEach(code => usedCourseCodes.add(code));
            });
        
            //   مرحله ۲: فقط رشته‌هایی که در هنرستان‌ها هستند
            const filteredCourses = Object.values(courseData).flat().filter(course =>
                usedCourseCodes.has(course.code)
            );
        
            //   مرحله ۳: پر کردن کمبوباکس رشته‌ها
            
const courseSelect = document.getElementById("courseSelect");
courseSelect.innerHTML = `<option value="" selected>انتخاب رشته</option>`;

filteredCourses.sort((a, b) => a.name.localeCompare(b.name, "fa"));
filteredCourses.forEach(course => {
    const option = document.createElement("option");
    option.value = course.code;
    option.textContent = course.name;
    courseSelect.appendChild(option);
});

// سپس فعال کردن Select2 روی select
$(document).ready(function() {
    $('#courseSelect').select2({
        placeholder: "انتخاب رشته",
        allowClear: true,
        dir: "rtl",
        minimumResultsForSearch: 5,
        dropdownAutoWidth: true,
        width: 'resolve'
    });
});

// و اضافه کردن event listener برای فیلتر
$('#courseSelect').on('change', function () {
    map.closePopup(); // Close popups when course is changed
    const value = $(this).val();
    activeFilters.selectedCourse = value ? value : null;
    applyFilters();
});
        
            addMarkers(allSchools);
        })
        
        .catch(err => {
            console.error("خطا در بارگذاری فایل‌ها:", err);
        });

    // بارگذاری و رسم نواحی روی نقشه
    fetch("js/zonesRange.json")
        .then(res => res.json())
        .then(zones => {
            zones.forEach(zone => {
                const polygon = L.polygon(zone.coordinates, {
                    color: zone.color,
                    weight: 2,
                    fillColor: zone.color,
                    fillOpacity: 0.1
                }).addTo(map).bindPopup(`<div class="zone-label">${zone.name.replace(/[0-9]/g, d => toPersianNum(d))}</div>`, {
                    closeButton: false,
                    autoClose: true,
                    className: 'zone-popup'
                });
                
                zonePolygons[zone.id] = polygon;

                // اضافه کردن رویداد hover
                polygon.on('mouseover', function(e) {
                    this.setStyle({
                        fillOpacity: 0.3
                    });
                });
                
                polygon.on('mouseout', function(e) {
                    if (this !== zonePolygons[activeZoneId]) {
                        this.setStyle({
                            fillOpacity: 0.1
                        });
                    }
                });
            });
        });

    // بارگذاری لیست نواحی
    fetch("js/zones.json")
        .then(res => res.json())
        .then(zones => {
            const zoneSelect = document.getElementById("zoneSelect");
            zoneSelect.innerHTML = `<option value="0" selected>تمامی نواحی</option>`;
            zones.forEach(zone => {
                const option = document.createElement("option");
                option.value = zone.id;
                option.textContent = zone.name.replace(/[0-9]/g, d => toPersianNum(d));
                zoneSelect.appendChild(option);
            });

            zoneSelect.addEventListener("change", function () {
                map.closePopup(); // Close popups when zone is changed
                const selectedZoneId = this.value;
                activeFilters.selectedZone = selectedZoneId === "0" ? null : selectedZoneId;
                highlightZone(selectedZoneId === "0" ? null : selectedZoneId);
                applyFilters();
            });
        });

    // فیلترهای دکمه‌ای
    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", function () {
            // Close all open popups
            map.closePopup();
            
            const value = this.dataset.filter;
            this.classList.toggle("active");

            const prefix = value[0];
            if (prefix === "G") toggleCodeFilter("gender_specific_code", value);
            if (prefix === "T") toggleCodeFilter("technical_or_vocational_code", value);
            if (prefix === "P") toggleCodeFilter("public_or_private_code", value);

            applyFilters();
        });
    });

    function toggleCodeFilter(key, value) {
        const arr = activeFilters[key];
        const i = arr.indexOf(value);
        if (i === -1) arr.push(value);
        else arr.splice(i, 1);
    }

    // جستجو زنده
    // document.getElementById("search").addEventListener("input", function () {
    //     activeFilters.searchText = this.value.trim();
    //     applyFilters();
    // });

    // تنظیم کنترل سایز فونت
    const decreaseBtn = document.getElementById('decrease-font');
    const increaseBtn = document.getElementById('increase-font');
    let currentFontSize = 1; // 0: small, 1: normal, 2: large, 3: larger

    function updateFontSize() {
        document.body.classList.remove('font-small', 'font-large', 'font-larger');
        if (currentFontSize === 0) {
            document.body.classList.add('font-small');
        } else if (currentFontSize === 2) {
            document.body.classList.add('font-large');
        } else if (currentFontSize === 3) {
            document.body.classList.add('font-larger');
        }

        // به‌روزرسانی وضعیت دکمه‌ها
        decreaseBtn.disabled = currentFontSize === 0;
        increaseBtn.disabled = currentFontSize === 3;

        // ذخیره تنظیمات در localStorage
        localStorage.setItem('fontSizePreference', currentFontSize);
    }

    // بازیابی تنظیمات قبلی
    const savedFontSize = localStorage.getItem('fontSizePreference');
    if (savedFontSize !== null) {
        currentFontSize = parseInt(savedFontSize);
        updateFontSize();
    }

    decreaseBtn.addEventListener('click', () => {
        if (currentFontSize > 0) {
            currentFontSize--;
            updateFontSize();
        }
    });

    increaseBtn.addEventListener('click', () => {
        if (currentFontSize < 3) {
            currentFontSize++;
            updateFontSize();
        }
    });

    let userMarker = null;
    let rangeCircle = null;
    const NEARBY_RADIUS = 3000; // 3 کیلومتر

    // تابع محاسبه فاصله بین دو نقطه (به متر)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // شعاع زمین به متر
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    let activeSchoolCard = null;

    function showSchoolLocation(school, card) {
        // حذف کلاس active از کارت قبلی
        if (activeSchoolCard) {
            activeSchoolCard.classList.remove('active');
        }
        
        // اضافه کردن کلاس active به کارت جدید
        card.classList.add('active');
        activeSchoolCard = card;

        // تنظیم نمای نقشه و نمایش پاپ‌آپ
        const lat = parseFloat(school.latitude);
        const lng = parseFloat(school.longitude);
        
        // ساخت محتوای پاپ‌آپ
        const courseCodes = Array.isArray(school.cources)
            ? school.cources
            : typeof school.cources === "string"
            ? school.cources.split(",")
            : [];

        const courseNames = courseCodes
            .map(code => code.trim())
            .filter(code => code)
            .map(code => courseMap[code] || code)
            .join("، ");

        const popup = `
            <div class="popup">
                هنرستان <b style="color: #33358a;">${school.school_name}</b> - ${school.districtN || ""}<br>
                ${school.technical_or_vocational}، ${school.gender_specific}، ${school.public_or_private}<br>
                <b>رشته‌های فعال: </b>${courseNames}<br>
                <b>نشانی: </b>${school.address || ""}<br>
                <b>تلفن: </b>${toPersianNum(school.tel) || ""}
            </div>
        `;

        // نمایش پاپ‌آپ و زوم روی هنرستان
        map.setView([lat, lng], 17);
        L.popup()
            .setLatLng([lat, lng])
            .setContent(popup)
            .openOn(map);

        // هایلایت کردن ناحیه
        highlightZone(school.district);
    }

    function createSchoolCard(school, index, distanceKm) {
        return `
            <div class="school-card" id="school-${index}" onclick="handleSchoolCardClick(${index})">
                <div class="school-name">${school.school_name}</div>
                <div class="school-distance">${toPersianNum(distanceKm)} کیلومتر</div>
            </div>
        `;
    }

    function showSchoolsList(schools) {
        // حذف لیست قبلی اگر وجود دارد
        const existingList = document.querySelector('.schools-list');
        if (existingList) {
            existingList.remove();
        }

        // ایجاد لیست جدید
        const listContainer = document.createElement('div');
        listContainer.className = 'schools-list';
        listContainer.style.opacity = '0';
        listContainer.style.transform = 'translateY(-20px)';

        // اضافه کردن هدر (فقط برای دسکتاپ)
        if (window.innerWidth > 768) {
            const header = document.createElement('div');
            header.className = 'schools-list-header';
            header.innerHTML = `
                <div class="schools-list-title">لیست هنرستان‌ها</div>
                <div class="close-list" onclick="closeSchoolsList()">&times;</div>
            `;
            listContainer.appendChild(header);
        }

        // اضافه کردن آیتم‌های هنرستان
        schools.forEach((school, index) => {
            const item = document.createElement('div');
            item.className = 'school-item';
            item.setAttribute('data-school-id', index);

            // محاسبه فاصله برای نمایش (اگر موجود باشد)
            const distanceText = school.distance ? 
                `<div class="school-distance">${toPersianNum((school.distance / 1000).toFixed(1))} کیلومتر</div>` : '';

            item.innerHTML = `
                <div class="school-item-content" onclick="showSchoolDetails(${index})">
                    <div class="school-item-name">${school.school_name}</div>
                    <div class="school-item-district">ناحیه ${toPersianNum(school.district)}</div>
                    ${distanceText}
                </div>
                <div class="remove-school" onclick="event.stopPropagation(); removeSchoolFromList(${index})">&times;</div>
            `;
            listContainer.appendChild(item);
        });

        document.body.appendChild(listContainer);

        // انیمیشن نمایش لیست
        requestAnimationFrame(() => {
            listContainer.style.opacity = '1';
            listContainer.style.transform = 'translateY(0)';
        });

        // اضافه کردن قابلیت اسکرول افقی با لمس و درگ برای موبایل
        if (window.innerWidth <= 768) {
            let isScrolling = false;
            let startX;
            let scrollLeft;
            let momentumID;
            let velocity = 0;
            let lastX;
            let lastTime;

            function updateScroll() {
                if (Math.abs(velocity) > 0.1) {
                    listContainer.scrollLeft -= velocity;
                    velocity *= 0.95; // کاهش تدریجی سرعت
                    momentumID = requestAnimationFrame(updateScroll);
                }
            }

            listContainer.addEventListener('touchstart', (e) => {
                isScrolling = true;
                startX = e.touches[0].pageX - listContainer.offsetLeft;
                scrollLeft = listContainer.scrollLeft;
                lastX = e.touches[0].pageX;
                lastTime = Date.now();
                velocity = 0;
                
                if (momentumID) {
                    cancelAnimationFrame(momentumID);
                }
            });

            listContainer.addEventListener('touchmove', (e) => {
                if (!isScrolling) return;
                e.preventDefault();
                const x = e.touches[0].pageX - listContainer.offsetLeft;
                const walk = (x - startX);
                listContainer.scrollLeft = scrollLeft - walk;

                // محاسبه سرعت برای momentum
                const now = Date.now();
                const dt = now - lastTime;
                const dx = e.touches[0].pageX - lastX;
                velocity = dx / dt * 15; // ضریب برای تنظیم قدرت momentum
                lastX = e.touches[0].pageX;
                lastTime = now;
            });

            listContainer.addEventListener('touchend', () => {
                isScrolling = false;
                // شروع انیمیشن momentum
                momentumID = requestAnimationFrame(updateScroll);
            });

            // اضافه کردن نشانگر اسکرول
            const scrollIndicator = document.createElement('div');
            scrollIndicator.className = 'scroll-indicator';
            listContainer.appendChild(scrollIndicator);

            // نمایش/مخفی کردن نشانگر اسکرول بر اساس محتوا
            const updateScrollIndicator = () => {
                const hasHorizontalScroll = listContainer.scrollWidth > listContainer.clientWidth;
                scrollIndicator.style.display = hasHorizontalScroll ? 'block' : 'none';
            };

            // آپدیت نشانگر در لود و ریسایز
            updateScrollIndicator();
            window.addEventListener('resize', updateScrollIndicator);
        }
    }

    // تابع نمایش جزئیات هنرستان
    window.showSchoolDetails = function(index) {
        const school = window.nearbySchools[index];
        if (!school) return;

        // حذف کلاس active از آیتم قبلی
        const previousActive = document.querySelector('.school-item.active');
        if (previousActive) {
            previousActive.classList.remove('active');
        }

        // اضافه کردن کلاس active به آیتم جدید
        const currentItem = document.querySelector(`[data-school-id="${index}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }

        // نمایش موقعیت و اطلاعات هنرستان روی نقشه
        const lat = parseFloat(school.latitude);
        const lng = parseFloat(school.longitude);

        // ساخت محتوای پاپ‌آپ
        const courseCodes = Array.isArray(school.cources)
            ? school.cources
            : typeof school.cources === "string"
            ? school.cources.split(",")
            : [];

        const courseNames = courseCodes
            .map(code => code.trim())
            .filter(code => code)
            .map(code => courseMap[code] || code)
            .join("، ");

        const popup = `
            <div class="popup">
                هنرستان <b style="color: #33358a;">${school.school_name}</b> - ${school.districtN || ""}<br>
                ${school.technical_or_vocational}، ${school.gender_specific}، ${school.public_or_private}<br>
                <b>رشته‌های فعال: </b>${courseNames}<br>
                <b>نشانی: </b>${school.address || ""}<br>
                <b>تلفن: </b>${toPersianNum(school.tel) || ""}
            </div>
        `;

        // نمایش پاپ‌آپ و زوم روی هنرستان
        map.setView([lat, lng], 17);
        L.popup()
            .setLatLng([lat, lng])
            .setContent(popup)
            .openOn(map);

        // هایلایت کردن ناحیه
        highlightZone(school.district);
    };

    // تابع حذف هنرستان از لیست
    window.removeSchoolFromList = function(index) {
        const item = document.querySelector(`[data-school-id="${index}"]`);
        if (item) {
            // اگر این آیتم انتخاب شده بود
            if (item.classList.contains('active')) {
                // زوم اوت روی نقشه
                if (rangeCircle) {
                    map.fitBounds(rangeCircle.getBounds(), { padding: [50, 50] });
                } else {
                    map.setView([36.2977, 59.6057], 13); // مرکز مشهد
                }
                // بستن پاپ‌آپ
                map.closePopup();
                // حذف هایلایت ناحیه
                highlightZone(null);
            }

            // حذف آیتم با انیمیشن
            item.style.opacity = '0';
            item.style.transform = 'scale(0.8)';
            setTimeout(() => {
                item.remove();
                // اگر لیست خالی شد، کل لیست را ببند
                const list = document.querySelector('.schools-list');
                if (list && !list.querySelector('.school-item')) {
                    closeSchoolsList();
                }
            }, 200);
        }
    };

    // تابع بستن لیست
    window.closeSchoolsList = function() {
        const list = document.querySelector('.schools-list');
        if (list) {
            list.style.opacity = '0';
            list.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                list.remove();
                // پاک کردن مارکر کاربر و دایره محدوده
                if (userMarker) map.removeLayer(userMarker);
                if (rangeCircle) map.removeLayer(rangeCircle);
                // نمایش مجدد همه هنرستان‌ها
                addMarkers(allSchools);
                // حذف هایلایت ناحیه
                highlightZone(null);
                // بستن پاپ‌آپ باز
                map.closePopup();
                // زوم اوت به نمای کلی شهر
                map.setView([36.2977, 59.6057], 13);
            }, 200);
        }
    };

    // تابع نمایش نزدیک‌ترین هنرستان‌ها
    function showNearbySchools(position) {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // حذف مارکر و دایره قبلی
        if (userMarker) map.removeLayer(userMarker);
        if (rangeCircle) map.removeLayer(rangeCircle);

        // نمایش موقعیت کاربر
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background-color: #4A90E2; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white;"></div>',
            iconSize: [18, 18]
        });

        userMarker = L.marker([userLat, userLng], {icon: userIcon}).addTo(map);
        
        // نمایش دایره محدوده
        rangeCircle = L.circle([userLat, userLng], {
            radius: NEARBY_RADIUS,
            color: '#4A90E2',
            fillColor: '#4A90E2',
            fillOpacity: 0.1,
            weight: 2,
            className: 'range-circle'
        }).addTo(map);

        // محاسبه فاصله برای همه هنرستان‌ها
        window.nearbySchools = allSchools
            .map(school => {
                const distance = calculateDistance(
                    userLat, userLng,
                    parseFloat(school.latitude),
                    parseFloat(school.longitude)
                );
                return { ...school, distance };
            })
            .filter(school => school.distance <= NEARBY_RADIUS)
            .sort((a, b) => a.distance - b.distance);

        if (nearbySchools.length > 0) {
            // نمایش لیست هنرستان‌ها
            showSchoolsList(nearbySchools);
            
            // نمایش هنرستان‌های نزدیک روی نقشه
            addMarkers(nearbySchools);
            
            // تنظیم نمای نقشه
            map.fitBounds(rangeCircle.getBounds(), { padding: [50, 50] });
        } else {
            alert('هیچ هنرستانی در محدوده ۳ کیلومتری شما یافت نشد.');
        }
    }

    // تابع کلیک روی کارت هنرستان
    window.handleSchoolCardClick = function(index) {
        const school = window.nearbySchools[index];
        const card = document.getElementById(`school-${index}`);
        if (school && card) {
            showSchoolLocation(school, card);
        }
    };

    // مدیریت خطای دسترسی به موقعیت
    function handleLocationError(error) {
        const nearbyInfo = document.getElementById('nearby-info');
        const nearbySchools = document.getElementById('nearby-schools');
        
        let message = 'خطا در دریافت موقعیت مکانی: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'لطفاً دسترسی به موقعیت مکانی را فعال کنید.';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'موقعیت مکانی در دسترس نیست.';
                break;
            case error.TIMEOUT:
                message += 'زمان درخواست موقعیت مکانی به پایان رسید.';
                break;
            default:
                message += 'خطای ناشناخته رخ داده است.';
        }
        
        nearbyInfo.innerHTML = `<div class="info">${message}</div>`;
        nearbySchools.classList.add('active');
    }

    let locationMarker = null;
    let selectedLocation = null;
    let isSelectingLocation = false;

    document.getElementById('nearby-btn').addEventListener('click', function() {
        if (!isSelectingLocation) {
            // بستن تمام پاپ‌آپ‌های موجود
            map.closePopup();
            
            // فعال کردن حالت انتخاب مکان
            isSelectingLocation = true;
            this.classList.add('active');
            this.textContent = 'لغو انتخاب موقعیت';
            map.getContainer().style.cursor = 'crosshair';

            // غیرفعال کردن موقت رویدادهای نواحی
            Object.values(zonePolygons).forEach(polygon => {
                polygon.off('mouseover');
                polygon.off('mouseout');
                polygon.off('click');
                polygon.unbindPopup();
            });

            // نمایش راهنما به صورت پاپ‌آپ
            const helpPopup = document.createElement('div');
            helpPopup.className = 'help-popup';
            helpPopup.innerHTML = 'برای انتخاب موقعیت روی نقشه کلیک کنید';
            document.body.appendChild(helpPopup);

            // حذف پاپ‌آپ راهنما بعد از 3 ثانیه
            setTimeout(() => {
                if (helpPopup.parentNode) {
                    helpPopup.parentNode.removeChild(helpPopup);
                }
            }, 3000);

            function handleLocationSelect(e) {
                const latlng = e.latlng;
                
                // حذف مارکر و دایره قبلی
                if (locationMarker) {
                    map.removeLayer(locationMarker);
                }
                if (selectedLocation) {
                    map.removeLayer(selectedLocation);
                }
                
                // ایجاد مارکر جدید
                locationMarker = L.marker(latlng, {
                    draggable: true,
                    icon: L.divIcon({
                        className: 'selected-location-marker',
                        html: '',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);
                
                // ایجاد دایره محدوده با شعاع 3 کیلومتر
                selectedLocation = L.circle(latlng, {
                    radius: 3000,
                    color: '#4A90E2',
                    fillColor: '#4A90E2',
                    fillOpacity: 0.1,
                    weight: 2,
                    className: 'range-circle'
                }).addTo(map);

                // به‌روزرسانی موقعیت دایره با جابجایی مارکر
                locationMarker.on('drag', function(e) {
                    selectedLocation.setLatLng(e.target.getLatLng());
                });

                // تنظیم نمای نقشه با زوم ملایم
                const bounds = selectedLocation.getBounds();
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 15,
                    animate: true,
                    duration: 0.5
                });

                // نمایش دکمه‌های تایید و لغو
                document.getElementById('location-buttons').classList.add('active');
            }

            // اضافه کردن رویداد کلیک به نقشه
            map.on('click', handleLocationSelect);

            // تنظیم رویدادهای دکمه‌های تایید و لغو
            document.getElementById('confirm-location-btn').addEventListener('click', function() {
                if (locationMarker) {
                    // بازگشت به حالت عادی
                    isSelectingLocation = false;
                    document.getElementById('nearby-btn').classList.remove('active');
                    document.getElementById('nearby-btn').textContent = 'هنرستان‌های نزدیک';
                    map.getContainer().style.cursor = '';
                    
                    // حذف رویدادهای کلیک
                    map.off('click', handleLocationSelect);
                    
                    // پنهان کردن دکمه‌های تایید و لغو
                    document.getElementById('location-buttons').classList.remove('active');
                    
                    // فعال‌سازی مجدد رویدادهای نواحی
                    initializeZoneEvents();
                    
                    // جستجوی هنرستان‌های نزدیک
                    findNearbySchools(locationMarker.getLatLng());
                }
            });

            document.getElementById('cancel-location-btn').addEventListener('click', function() {
                // بازگشت به حالت عادی
                isSelectingLocation = false;
                document.getElementById('nearby-btn').classList.remove('active');
                document.getElementById('nearby-btn').textContent = 'هنرستان‌های نزدیک';
                map.getContainer().style.cursor = '';
                
                // حذف رویدادهای کلیک
                map.off('click', handleLocationSelect);
                
                // پنهان کردن دکمه‌های تایید و لغو
                document.getElementById('location-buttons').classList.remove('active');
                
                // حذف مارکر و دایره
                if (locationMarker) {
                    map.removeLayer(locationMarker);
                    locationMarker = null;
                }
                if (selectedLocation) {
                    map.removeLayer(selectedLocation);
                    selectedLocation = null;
                }
                
                // فعال‌سازی مجدد رویدادهای نواحی
                initializeZoneEvents();
            });
        } else {
            // لغو حالت انتخاب مکان
            document.getElementById('cancel-location-btn').click();
        }
    });

    function initializeZoneEvents() {
        Object.values(zonePolygons).forEach(polygon => {
            polygon.on('mouseover', function(e) {
                this.setStyle({
                    fillOpacity: 0.3
                });
            });
            
            polygon.on('mouseout', function(e) {
                if (this !== zonePolygons[activeZoneId]) {
                    this.setStyle({
                        fillOpacity: 0.1
                    });
                }
            });
        });
    }

    let currentRoute = null;

    function findNearbySchools(latlng) {
        const nearbySchools = [];
        
        // Check each marker for distance and school properties
        markers.forEach(marker => {
            const distance = marker.getLatLng().distanceTo(latlng);
            if (distance <= 3000) { // Within 3km
                const school = allSchools.find(s => 
                    parseFloat(s.latitude) === marker.getLatLng().lat && 
                    parseFloat(s.longitude) === marker.getLatLng().lng
                );
                
                if (school) {
                    nearbySchools.push({
                        ...school,
                        distance: Math.round(distance),
                        marker: marker
                    });
                }
            }
        });
        
        // Sort by distance
        nearbySchools.sort((a, b) => a.distance - b.distance);
        
        // Show results in a popup
        if (nearbySchools.length > 0) {
            let content = '<div class="nearby-schools active">';
            content += '<div class="nearby-schools-header">';
            content += `<h3>هنرستان‌های نزدیک (${nearbySchools.length} مورد)</h3>`;
            content += '<button class="close-nearby" title="بستن و پایان مسیریابی">×</button>';
            content += '</div>';
            
            // Add schools list
            content += '<div class="schools-list">';
            nearbySchools.forEach((school, index) => {
                const distanceKm = (school.distance / 1000).toFixed(1);
                content += `
                    <div class="school-card" data-school-index="${index}" data-lat="${school.latitude}" data-lng="${school.longitude}">
                        <div class="school-info">
                            <span class="school-name">${school.school_name}</span>
                            <span class="school-distance">${distanceKm} کیلومتر</span>
                        </div>
                    </div>
                `;
            });
            content += '</div></div>';
            
            // Remove existing nearby schools popup if any
            const existingPopup = document.querySelector('.nearby-schools');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            // Add new popup
            document.body.insertAdjacentHTML('beforeend', content);
            
            // Add close button event listener
            document.querySelector('.close-nearby').addEventListener('click', function() {
                const nearbySchools = document.querySelector('.nearby-schools');
                nearbySchools.style.opacity = '0';
                nearbySchools.style.transform = 'translateY(-20px)';
                
                setTimeout(() => {
                    nearbySchools.remove();
                    // Remove route if exists
                    if (currentRoute) {
                        map.removeLayer(currentRoute);
                        currentRoute = null;
                    }
                    // Remove location marker
                    if (locationMarker) {
                        map.removeLayer(locationMarker);
                        locationMarker = null;
                    }
                    // Remove range circle
                    if (selectedLocation) {
                        map.removeLayer(selectedLocation);
                        selectedLocation = null;
                    }
                    // Reset map view
                    map.setView([36.2977, 59.6057], 13);
                }, 300);
            });
            
            // Add click events to school cards
            document.querySelectorAll('.school-card').forEach(card => {
                card.addEventListener('click', function() {
                    const lat = parseFloat(this.dataset.lat);
                    const lng = parseFloat(this.dataset.lng);
                    const index = parseInt(this.dataset.schoolIndex);
                    const school = nearbySchools[index];
                    
                    // Remove existing route if any
                    if (currentRoute) {
                        map.removeLayer(currentRoute);
                    }
                    
                    // Calculate route
                    const userLat = locationMarker.getLatLng().lat;
                    const userLng = locationMarker.getLatLng().lng;
                    
                    fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=full&geometries=geojson`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.routes && data.routes.length > 0) {
                                // Draw route on map
                                currentRoute = L.geoJSON(data.routes[0].geometry, {
                                    style: {
                                        color: '#4A90E2',
                                        weight: 6,
                                        opacity: 0.6
                                    }
                                }).addTo(map);
                                
                                // Fit map to show the entire route
                                map.fitBounds(currentRoute.getBounds(), {
                                    padding: [50, 50]
                                });
                            }
                        });
                    
                    // Highlight active card
                    document.querySelectorAll('.school-card').forEach(c => {
                        c.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    // Open school popup
                    school.marker.openPopup();
                });
            });
        } else {
            alert('هیچ هنرستانی در شعاع ۳ کیلومتری این نقطه یافت نشد.');
        }
    }

    // Add zoom controls to the header
    const zoomControl = L.control.zoom({
        position: 'topright'
    });
    map.addControl(zoomControl);

    /*
    // Add nearby schools button
    const nearbySchoolsButton = L.control({ position: 'topright' });
    nearbySchoolsButton.onAdd = function() {
        const button = L.DomUtil.create('button', 'custom-map-button');
        button.innerHTML = 'هنرستان‌های نزدیک';
        button.onclick = function() {
            if (locationMarker) {
                const latlng = locationMarker.getLatLng();
                findNearbySchools(latlng.lat, latlng.lng);
            } else {
                alert('لطفاً ابتدا موقعیت خود را روی نقشه مشخص کنید.');
            }
        };
        return button;
    };
    nearbySchoolsButton.addTo(map);
    */
});
