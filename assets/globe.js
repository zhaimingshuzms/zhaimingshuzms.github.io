(() => {
    const canvas = document.getElementById("globe");
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = {
        longitude: -1.8,
        latitude: -0.25,
        velocityX: 0,
        velocityY: 0,
        dragging: false,
        pointerX: 0,
        pointerY: 0,
        size: 0,
        dpr: 1,
        lastTime: performance.now()
    };

    const deg = Math.PI / 180;
    const hangzhou = { lon: 120.15, lat: 30.27 };

    // Generated from Natural Earth 1:110m data. The point cloud and coastline
    // are projected onto a sphere at render time, so they rotate as true 3D data.
    const landData = window.__GLOBE_LAND_DATA__ || { points: [], rings: [] };
    const landPoints = landData.points;
    const landRings = landData.rings;

    function project(lon, lat, radius, centerX, centerY) {
        const lambda = lon * deg + state.longitude;
        const phi = lat * deg;
        const cosPhi = Math.cos(phi);
        const x = cosPhi * Math.sin(lambda);
        const rawY = Math.sin(phi);
        const rawZ = cosPhi * Math.cos(lambda);

        const cosTilt = Math.cos(state.latitude);
        const sinTilt = Math.sin(state.latitude);
        const y = rawY * cosTilt - rawZ * sinTilt;
        const z = rawY * sinTilt + rawZ * cosTilt;

        return {
            x: centerX + x * radius,
            y: centerY - y * radius,
            z
        };
    }

    function drawSphere(centerX, centerY, radius) {
        const ocean = context.createRadialGradient(
            centerX - radius * 0.38,
            centerY - radius * 0.43,
            radius * 0.05,
            centerX,
            centerY,
            radius
        );
        ocean.addColorStop(0, "#235b91");
        ocean.addColorStop(0.28, "#123b6d");
        ocean.addColorStop(0.72, "#091c3e");
        ocean.addColorStop(1, "#030714");

        context.save();
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fillStyle = ocean;
        context.fill();
        context.clip();

        const glow = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
        glow.addColorStop(0, "rgba(0, 0, 0, .54)");
        glow.addColorStop(0.33, "rgba(62, 206, 255, .04)");
        glow.addColorStop(0.7, "rgba(80, 118, 240, .06)");
        glow.addColorStop(1, "rgba(0, 0, 0, .72)");
        context.fillStyle = glow;
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        context.restore();

        context.beginPath();
        context.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
        context.strokeStyle = "rgba(103, 224, 255, .42)";
        context.lineWidth = 1;
        context.stroke();

        context.beginPath();
        context.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
        context.strokeStyle = "rgba(70, 170, 255, .10)";
        context.lineWidth = 10;
        context.stroke();
    }

    function drawProjectedLine(points, radius, centerX, centerY, color, lineWidth) {
        context.beginPath();
        let drawing = false;
        points.forEach(([lon, lat]) => {
            const projected = project(lon, lat, radius, centerX, centerY);
            if (projected.z <= 0.012) {
                drawing = false;
                return;
            }
            if (!drawing) {
                context.moveTo(projected.x, projected.y);
                drawing = true;
            } else {
                context.lineTo(projected.x, projected.y);
            }
        });
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.stroke();
    }

    function drawGraticule(centerX, centerY, radius) {
        for (let lon = -180; lon < 180; lon += 30) {
            const points = [];
            for (let lat = -88; lat <= 88; lat += 2) points.push([lon, lat]);
            drawProjectedLine(points, radius, centerX, centerY, "rgba(110, 207, 255, .10)", 0.7);
        }

        for (let lat = -60; lat <= 60; lat += 30) {
            const points = [];
            for (let lon = -180; lon <= 180; lon += 2) points.push([lon, lat]);
            drawProjectedLine(points, radius, centerX, centerY, "rgba(110, 207, 255, .10)", 0.7);
        }
    }

    function drawLand(centerX, centerY, radius) {
        landPoints.forEach(([lon, lat]) => {
            const projected = project(lon, lat, radius, centerX, centerY);
            if (projected.z <= 0) return;

            const visibility = Math.min(1, projected.z * 2.3);
            const dotRadius = Math.max(0.38, radius * 0.0036 * (0.55 + projected.z * 0.55));
            context.beginPath();
            context.arc(projected.x, projected.y, dotRadius, 0, Math.PI * 2);
            context.fillStyle = `rgba(112, 255, 218, ${0.2 + visibility * 0.64})`;
            context.fill();
        });
    }

    function drawCoastlines(centerX, centerY, radius) {
        landRings.forEach((ring) => {
            drawProjectedLine(
                ring,
                radius,
                centerX,
                centerY,
                "rgba(126, 255, 224, .34)",
                0.72
            );
        });
    }

    function drawHomeMarker(centerX, centerY, radius, time) {
        const projected = project(hangzhou.lon, hangzhou.lat, radius, centerX, centerY);
        if (projected.z < 0.08) return;

        const pulse = 5 + (Math.sin(time * 0.003) + 1) * 4;
        context.beginPath();
        context.arc(projected.x, projected.y, pulse, 0, Math.PI * 2);
        context.strokeStyle = `rgba(255, 255, 255, ${0.46 - pulse * 0.02})`;
        context.lineWidth = 1;
        context.stroke();

        context.beginPath();
        context.arc(projected.x, projected.y, 2.7, 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.shadowColor = "#6fffd9";
        context.shadowBlur = 13;
        context.fill();
        context.shadowBlur = 0;
    }

    function drawAtmosphere(centerX, centerY, radius) {
        const atmosphere = context.createRadialGradient(
            centerX,
            centerY,
            radius * 0.82,
            centerX,
            centerY,
            radius * 1.18
        );
        atmosphere.addColorStop(0, "rgba(65, 197, 255, 0)");
        atmosphere.addColorStop(.7, "rgba(65, 197, 255, .08)");
        atmosphere.addColorStop(1, "rgba(65, 197, 255, 0)");
        context.beginPath();
        context.arc(centerX, centerY, radius * 1.18, 0, Math.PI * 2);
        context.fillStyle = atmosphere;
        context.fill();
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        state.dpr = Math.min(window.devicePixelRatio || 1, 2);
        state.size = Math.max(1, Math.min(rect.width, rect.height));
        canvas.width = Math.round(rect.width * state.dpr);
        canvas.height = Math.round(rect.height * state.dpr);
        context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }

    function render(time) {
        const width = canvas.width / state.dpr;
        const height = canvas.height / state.dpr;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.365;

        context.clearRect(0, 0, width, height);
        drawAtmosphere(centerX, centerY, radius);
        drawSphere(centerX, centerY, radius);
        drawGraticule(centerX, centerY, radius);
        drawLand(centerX, centerY, radius);
        drawCoastlines(centerX, centerY, radius);
        drawHomeMarker(centerX, centerY, radius, time);

        const delta = Math.min(32, time - state.lastTime);
        state.lastTime = time;

        if (!state.dragging) {
            state.longitude += state.velocityX * delta;
            state.latitude += state.velocityY * delta;
            state.velocityX *= 0.955;
            state.velocityY *= 0.93;

            if (!reducedMotion && Math.abs(state.velocityX) < 0.00005) {
                state.longitude += 0.000075 * delta;
            }
        }

        state.latitude = Math.max(-0.95, Math.min(0.95, state.latitude));
        requestAnimationFrame(render);
    }

    canvas.addEventListener("pointerdown", (event) => {
        state.dragging = true;
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
        state.velocityX = 0;
        state.velocityY = 0;
        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
        if (!state.dragging) return;
        const deltaX = event.clientX - state.pointerX;
        const deltaY = event.clientY - state.pointerY;
        state.longitude += deltaX * 0.007;
        state.latitude -= deltaY * 0.006;
        state.velocityX = deltaX * 0.00028;
        state.velocityY = -deltaY * 0.00022;
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
    });

    function releasePointer(event) {
        state.dragging = false;
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
    }

    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);

    canvas.addEventListener("keydown", (event) => {
        const keyMap = {
            ArrowLeft: [0.12, 0],
            ArrowRight: [-0.12, 0],
            ArrowUp: [0, 0.1],
            ArrowDown: [0, -0.1]
        };
        if (!keyMap[event.key]) return;
        event.preventDefault();
        state.longitude += keyMap[event.key][0];
        state.latitude += keyMap[event.key][1];
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    requestAnimationFrame(render);
})();
