document.addEventListener("DOMContentLoaded", function () {
    const map = L.map("map").setView([36.2977, 59.6057], 13); // Mashhad
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const girlIcon = L.icon({ iconUrl: "image/girl.png", iconSize: [32, 32] });
    const boyIcon = L.icon({ iconUrl: "image/boy.png", iconSize: [32, 32] });

    let allSchools = [];
    let markers = [];
    let zonePolygons = [];

    let activeFilters = {
        gender_specific_code: [],
        technical_or_vocational_code: [],
        public_or_private_code: [],
        selectedCourse: null,
        selectedZone: null,
        searchText: ""
    };

    function addMarkers(filteredSchools) {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];

        filteredSchools.forEach(school => {
            const lat = parseFloat(school.latitude);
            const lng = parseFloat(school.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const icon = school.gender_specific_code === "G1" ? girlIcon : boyIcon;
            const popup = `
                <b>${school.school_name}</b><br>
                ${school.technical_or_vocational} - ${school.gender_specific} - ${school.public_or_private}<br>
                ${school.districtN || ""}<br>
                ${school.cources || ""}<br>
                ${school.address || ""}
            `;

            const marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup);
            markers.push(marker);
        });
    }

    function fuzzyMatch(text, keyword) {
        if (!text || !keyword) return false;
        text = text.toLowerCase();
        const words = keyword.toLowerCase().split(/\s+/);
        return words.every(w => text.includes(w));
    }

    function applyFilters() {
        let filtered = [...allSchools];

        // فیلتر ناحیه
        if (activeFilters.selectedZone) {
            filtered = filtered.filter(s => s.district === activeFilters.selectedZone);
        }

        // فیلتر رشته
        if (activeFilters.selectedCourse) {
            filtered = filtered.filter(s =>
                s.cources &&
                s.cources.split(",").map(c => c.trim()).includes(activeFilters.selectedCourse)
            );
        }

        // فیلتر بر اساس کدها
        filtered = filtered.filter(s =>
            (activeFilters.gender_specific_code.length === 0 || activeFilters.gender_specific_code.includes(s.gender_specific_code)) &&
            (activeFilters.technical_or_vocational_code.length === 0 || activeFilters.technical_or_vocational_code.includes(s.technical_or_vocational_code)) &&
            (activeFilters.public_or_private_code.length === 0 || activeFilters.public_or_private_code.includes(s.public_or_private_code))
        );

        // جستجوی فازی
        const query = activeFilters.searchText.trim().toLowerCase();
        if (query) {
            filtered = filtered.filter(s =>
                fuzzyMatch(s.school_name || "", query) ||
                fuzzyMatch(s.cources || "", query) ||
                fuzzyMatch(s.address || "", query)
            );
        }

        addMarkers(filtered);
    }

    // Load schools + course mappings
    // مرحله 1: خواندن لیست فایل‌های مدرسه
    fetch("js/SchoolFilesIndex.json")
    .then(res => res.json())
    .then(schoolFileNames => {
        // مرحله 2: خواندن همه فایل‌های مدرسه + فایل رشته‌ها
        const schoolFetches = schoolFileNames.map(name =>
            fetch(`js/SchoolJson//${name}`).then(res => res.json())
        );
    
        // اضافه کردن فایل رشته‌ها به پایان لیست
        return Promise.all([
            ...schoolFetches,
            fetch("js/cources.json").then(res => res.json())
        ]);
    })
    .then(allData => {
        const courseData = allData.pop(); // فایل آخر = رشته‌ها
        const schoolDataList = allData; // بقیه فایل‌ها = مدارس
    
        // ترکیب همه مدارس
        allSchools = schoolDataList.flatMap(data => {
            const key = Object.keys(data)[0];
            return data[key];
        });
    
        addMarkers(allSchools); // نمایش روی نقشه
    
        // ساخت map برای ترجمه کد رشته به اسم
        const codeToNameMap = {};
        Object.values(courseData).flat().forEach(c => {
            codeToNameMap[c.code] = c.name;
        });
    
        // پر کردن فیلتر رشته‌ها
        const courseSelect = document.getElementById("courseSelect");
        courseSelect.innerHTML = `<option value="all" selected>تمامی رشته‌ها</option>`;
    
        const courseCodes = new Set();
        allSchools.forEach(s => {
            (s.cources || "").split(",").forEach(code => courseCodes.add(code.trim()));
        });
    
        // مرتب‌سازی رشته‌ها بر اساس نام
        const sortedCourses = [...courseCodes]
            .map(code => ({ code, name: codeToNameMap[code] || code }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    
        sortedCourses.forEach(({ code, name }) => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = name;
            courseSelect.appendChild(option);
        });
    
        courseSelect.addEventListener("change", function () {
            activeFilters.selectedCourse = this.value === "all" ? null : this.value;
            applyFilters();
        });
    })
    .catch(err => {
        console.error("خطا در بارگذاری فایل‌ها:", err);
    });
    

    // // Load zones & draw polygons
    // fetch("js/zonesRange.json")
    //     .then(res => res.json())
    //     .then(zones => {
    //         zones.forEach(zone => {
    //             const polygon = L.polygon(zone.coordinates, {
    //                 color: zone.color,
    //                 fillColor: zone.color,
    //                 fillOpacity: 0.1
    //             }).addTo(map);
    //             zonePolygons.push(polygon);
    //         });
    //     });

    // Load zones & draw polygons + show all coordinates as points
// Load zones & draw polygons + show all coordinates as numbered points with exact coordinates
fetch("js/zonesRange.json")
    .then(res => res.json())
    .then(zones => {
        zones.forEach(zone => {
            // رسم چندضلعی ناحیه
            const polygon = L.polygon(zone.coordinates, {
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.1
            }).addTo(map);
            zonePolygons.push(polygon);

            // رسم تمام نقاط ناحیه با شماره‌گذاری و مختصات دقیق
            zone.coordinates.forEach((coord, index) => {
                const lat = coord[0];
                const lng = coord[1];

                L.circleMarker([lat, lng], {
                    radius: 3,
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: 0.8
                })
                .addTo(map)
                .bindPopup(`
                    <b>🔢 نقطه ${index + 1}</b><br>
                    📍 Latitude: ${lat}<br>
                    📍 Longitude: ${lng}
                `);
            });
        });
    });


    // Load zone dropdown
    fetch("js/zones.json")
        .then(res => res.json())
        .then(zones => {
            const zoneSelect = document.getElementById("zoneSelect");
            zoneSelect.innerHTML = `<option value="0" selected>تمامی نواحی</option>`;
            zones.forEach(zone => {
                const option = document.createElement("option");
                option.value = zone.id;
                option.textContent = zone.name;
                zoneSelect.appendChild(option);
            });

            zoneSelect.addEventListener("change", function () {
                activeFilters.selectedZone = this.value === "0" ? null : this.value;
                applyFilters();
            });
        });

    // دکمه‌های فیلتر
    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", function () {
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
    document.getElementById("search").addEventListener("input", function () {
        activeFilters.searchText = this.value.trim();
        applyFilters();
    });


    // map.on("click", function (e) {
    //     const lat = e.latlng.lat.toFixed(6);
    //     const lng = e.latlng.lng.toFixed(6);
    //     const coords = `${lat}, ${lng}`;
    
    //     navigator.clipboard.writeText(coords)
    //         .then(() => {
    //             alert(`مختصات ${coords} کپی شد!`);
    //         })
    //         .catch(err => {
    //             console.error("خطا در کپی کردن:", err);
    //         });
    // });
    

    // map.on("click", function (e) {
    //     const lat = e.latlng.lat.toFixed(12);
    //     const lng = e.latlng.lng.toFixed(12);
    //     const coords = `${lat}, ${lng}`;
    
    //     let clickedInZone = false;
    
    //     for (const polygon of zonePolygons) {
    //         if (polygon.getBounds().contains(e.latlng)) {
    //             clickedInZone = true;
    //             break;
    //         }
    //     }
    
    //     // بدون نمایش عنوان ناحیه، فقط مختصات کپی شود
    //     navigator.clipboard.writeText(coords)
    //         .then(() => {
    //             alert(`📌 مختصات ${coords} با موفقیت کپی شد.`);
    //         })
    //         .catch(err => {
    //             console.error("❌ خطا در کپی کردن مختصات:", err);
    //         });
    // });
    // let clickedPoints = [];
    // let polyline = null;
    
    // map.on("click", function (e) {
    //     const lat = +e.latlng.lat.toFixed(12);
    //     const lng = +e.latlng.lng.toFixed(12);
    //     const coords = [lat, lng];
    //     const coordText = `${lat}, ${lng}`;
    
    //     // افزودن مختصات جدید به لیست مسیر
    //     clickedPoints.push(coords);
    
    //     // نقطه سبز جدید در محل کلیک
    //     L.circleMarker(coords, {
    //         radius: 6,
    //         color: "green",
    //         fillColor: "green",
    //         fillOpacity: 1
    //     }).addTo(map);
    
    //     // رسم مسیر بین نقاط کلیک‌شده
    //     if (polyline) {
    //         map.removeLayer(polyline); // حذف مسیر قبلی
    //     }
    //     polyline = L.polyline(clickedPoints, {
    //         color: "green",
    //         weight: 3
    //     }).addTo(map);
    
    //     // کپی به کلیپ‌بورد
    //     navigator.clipboard.writeText(coordText)
    //         .then(() => console.log(`مختصات کپی شد: ${coordText}`))
    //         .catch(err => console.error("خطا در کپی:", err));
    // });
    
    let clickedPoints = [];

    map.on("click", function (e) {
        const lat = +e.latlng.lat.toFixed(12);
        const lng = +e.latlng.lng.toFixed(12);
        const coords = [lat, lng];
        const coordText = `${lat}, ${lng}`;
    
        // ذخیره نقطه در آرایه (اختیاری اگر بعداً نیاز دارید)
        clickedPoints.push(coords);
    
        // نمایش نقطه با رنگ قرمز روشن
        L.circleMarker(coords, {
            radius: 6,
            color: "#ff4d4d",         // خط دور قرمز روشن
            fillColor: "#ff9999",     // داخل قرمز روشن‌تر
            fillOpacity: 1
        }).addTo(map);
    
        // کپی مختصات به کلیپ‌بورد
        navigator.clipboard.writeText(coordText)
            .then(() => {
                console.log(`📌 مختصات کپی شد: ${coordText}`);
            })
            .catch(err => {
                console.error("❌ خطا در کپی:", err);
            });
    });
        
});
