import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Eye, BatteryCharging, Gauge, Zap } from 'lucide-react';

/**
 * Vehicle3DViewer — Renderizador 3D interactivo en tiempo real con Three.js
 * Muestra el chasis aerodinámico, el pack de celdas de batería iluminado
 * según el SoC real y simulación de flujo de carga de electrones.
 */
export default function Vehicle3DViewer({ vehiculo, soc = 80, isCharging = false }) {
  const mountRef = useRef(null);
  const [viewMode, setViewMode] = useState('exterior'); // 'exterior' | 'xray' | 'energy'
  const [autoRotate, setAutoRotate] = useState(true);

  // Referencias para manipular objetos Three.js dinámicamente
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const carGroupRef = useRef(null);
  const batteryCellsRef = useRef([]);
  const bodyMaterialRef = useRef(null);
  const glassMaterialRef = useRef(null);
  const particlesRef = useRef(null);

  // Cálculo de color de batería según el nivel de carga
  const getSocColor = (level) => {
    if (level < 20) return new THREE.Color(0xef4444); // Rojo alerta
    if (level < 45) return new THREE.Color(0xf59e0b); // Ámbar medio
    if (level < 75) return new THREE.Color(0x00d4ff); // Cyan eléctrico
    return new THREE.Color(0x10b981); // Verde óptimo
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 400;
    const height = 240;

    // 1. Escena & Cámara
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.2, 2.4, 4.2);

    // 2. Renderer WebGL con antialias
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // 3. Luces de estudio automotriz
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00d4ff, 2.0);
    dirLight1.position.set(5, 8, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-5, 4, -4);
    scene.add(dirLight2);

    const floorLight = new THREE.PointLight(getSocColor(soc).getHex(), 1.5, 6);
    floorLight.position.set(0, 0.1, 0);
    scene.add(floorLight);

    // 4. Construcción del Grupo Vehículo
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    // ─── Materiales ───
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2233,
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    bodyMaterialRef.current = bodyMat;

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050a14,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.6,
    });
    glassMaterialRef.current = glassMat;

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdde4f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x121418,
      roughness: 0.85,
    });

    // ─── Chasis Skateboard Inferior ───
    const chassisGeo = new THREE.BoxGeometry(3.6, 0.22, 1.6);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x0a0d14, metalness: 0.8, roughness: 0.4 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.35;
    carGroup.add(chassis);

    // ─── Pack de Celdas de Batería (Array de módulos iluminados) ───
    const cellsGroup = new THREE.Group();
    const cellGeo = new THREE.BoxGeometry(0.35, 0.12, 0.65);
    const cellsList = [];

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 7; c++) {
        const cellMat = new THREE.MeshStandardMaterial({
          color: getSocColor(soc),
          emissive: getSocColor(soc),
          emissiveIntensity: 0.8,
          roughness: 0.2,
          metalness: 0.3,
        });
        const cell = new THREE.Mesh(cellGeo, cellMat);
        cell.position.set(-1.2 + c * 0.4, 0.42, r === 0 ? -0.38 : 0.38);
        cellsGroup.add(cell);
        cellsList.push(cell);
      }
    }
    batteryCellsRef.current = cellsList;
    carGroup.add(cellsGroup);

    // ─── Carrocería Aerodinámica (Lower Body) ───
    const bodyGeo = new THREE.BoxGeometry(3.8, 0.55, 1.75);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    carGroup.add(body);

    // Front Nose / Capó aerodinámico
    const noseGeo = new THREE.CylinderGeometry(0.85, 0.88, 1.74, 16, 1, false, 0, Math.PI);
    noseGeo.rotateZ(Math.PI / 2);
    noseGeo.rotateY(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(1.4, 0.62, 0);
    carGroup.add(nose);

    // ─── Cabina / Habitáculo Acristalado ───
    const cabinGeo = new THREE.BoxGeometry(2.1, 0.55, 1.45);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(-0.2, 1.15, 0);
    carGroup.add(cabin);

    // ─── Faros LED Delanteros y Traseros ───
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const headLightGeo = new THREE.BoxGeometry(0.1, 0.08, 0.45);
    const hlLeft = new THREE.Mesh(headLightGeo, headLightMat);
    hlLeft.position.set(1.9, 0.68, 0.55);
    const hlRight = new THREE.Mesh(headLightGeo, headLightMat);
    hlRight.position.set(1.9, 0.68, -0.55);
    carGroup.add(hlLeft, hlRight);

    const tailLightGeo = new THREE.BoxGeometry(0.1, 0.06, 1.6);
    const tailBar = new THREE.Mesh(tailLightGeo, tailLightMat);
    tailBar.position.set(-1.9, 0.72, 0);
    carGroup.add(tailBar);

    // ─── Ruedas con Rines ───
    const wheelPositions = [
      [1.2, 0.35, 0.9],
      [1.2, 0.35, -0.9],
      [-1.2, 0.35, 0.9],
      [-1.2, 0.35, -0.9],
    ];

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 24);
    wheelGeo.rotateX(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.23, 12);
    rimGeo.rotateX(Math.PI / 2);

    wheelPositions.forEach(([x, y, z]) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.position.set(x, y, z);
      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.set(x, y, z);
      carGroup.add(tire, rim);
    });

    // ─── Sistema de Partículas para Modo Carga / Energía ───
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 3;
      particlePositions[i + 1] = 0.3 + Math.random() * 0.9;
      particlePositions[i + 2] = (Math.random() - 0.5) * 1.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00d4ff,
      size: 0.06,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particles.visible = false;
    particlesRef.current = particles;
    carGroup.add(particles);

    // Plataforma circular reflectante
    const floorGeo = new THREE.CircleGeometry(2.8, 36);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.6,
      metalness: 0.6,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = 0;
    scene.add(floorMesh);

    camera.lookAt(0, 0.65, 0);

    // ─── Interacción con mouse / arrastre ───
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      carGroup.rotation.y += deltaX * 0.008;
      prevMouseX = e.clientX;
    };
    const onMouseUp = () => { isDragging = false; };

    mount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // ─── Loop de Animación ───
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (autoRotate && !isDragging) {
        carGroup.rotation.y += 0.007;
      }

      // Animación suave de suspensión
      carGroup.position.y = Math.sin(elapsed * 1.5) * 0.02;

      // Animación de partículas si está en modo energía o cargando
      if (particles.visible) {
        const positions = particleGeo.attributes.position.array;
        for (let i = 1; i < particleCount * 3; i += 3) {
          positions[i] += 0.015;
          if (positions[i] > 1.4) positions[i] = 0.35;
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      camera.aspect = newW / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      mount.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Actualización reactiva al cambiar SoC o modo de vista
  useEffect(() => {
    const socColor = getSocColor(soc);

    // Actualizar celdas de batería
    batteryCellsRef.current.forEach((cell) => {
      cell.material.color = socColor;
      cell.material.emissive = socColor;
      cell.material.emissiveIntensity = viewMode === 'xray' || viewMode === 'energy' ? 1.4 : 0.8;
    });

    // Actualizar carrocería según modo
    if (bodyMaterialRef.current) {
      if (viewMode === 'xray') {
        bodyMaterialRef.current.transparent = true;
        bodyMaterialRef.current.opacity = 0.22;
        bodyMaterialRef.current.wireframe = false;
      } else if (viewMode === 'energy') {
        bodyMaterialRef.current.transparent = true;
        bodyMaterialRef.current.opacity = 0.45;
        bodyMaterialRef.current.wireframe = true;
      } else {
        bodyMaterialRef.current.transparent = false;
        bodyMaterialRef.current.opacity = 1.0;
        bodyMaterialRef.current.wireframe = false;
      }
      bodyMaterialRef.current.needsUpdate = true;
    }

    // Activar partículas en modo energía o cargando
    if (particlesRef.current) {
      particlesRef.current.visible = viewMode === 'energy' || isCharging;
    }
  }, [soc, viewMode, isCharging]);

  // Cálculos de telemetría proyectada
  const capKwh = vehiculo?.bateria_util_kWh || 77;
  const consumoMedio = vehiculo?.consumo_medio_kWh_100km || 18;
  const autonomiaTeoricaKm = Math.round(((capKwh * (soc / 100)) / consumoMedio) * 100);

  return (
    <div className="vehicle-3d-card">
      <div className="vehicle-3d-header">
        <div className="vehicle-3d-title-group">
          <span className="badge-3d-live">
            <span className="live-dot" /> 3D DIGITAL TWIN
          </span>
          <h4 className="vehicle-3d-model-name">
            {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo Eléctrico'}
          </h4>
        </div>

        <div className="vehicle-3d-actions">
          <div className="view-mode-selector">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'exterior' ? 'active' : ''}`}
              onClick={() => setViewMode('exterior')}
              title="Carrocería exterior"
            >
              <Eye size={13} /> Aero
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'xray' ? 'active' : ''}`}
              onClick={() => setViewMode('xray')}
              title="Chasis y celdas de batería X-Ray"
            >
              <BatteryCharging size={13} /> X-Ray
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'energy' ? 'active' : ''}`}
              onClick={() => setViewMode('energy')}
              title="Flujo de energía"
            >
              <Zap size={13} /> Flujo
            </button>
          </div>

          <button
            type="button"
            className={`btn-rotate-toggle ${autoRotate ? 'active' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title="Auto-rotación 360°"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas 3D */}
      <div
        ref={mountRef}
        className="vehicle-3d-canvas-wrap"
        title="Arrastra para rotar el vehículo en 360°"
      />

      {/* Telemetría Automotriz en tiempo real */}
      <div className="vehicle-3d-hud">
        <div className="hud-metric">
          <span className="hud-metric-label"><Gauge size={11} /> Autonomía Est.</span>
          <span className="hud-metric-val">{autonomiaTeoricaKm} <small>km</small></span>
        </div>
        <div className="hud-metric">
          <span className="hud-metric-label"><BatteryCharging size={11} /> Nivel Batería</span>
          <span className={`hud-metric-val ${soc < 20 ? 'danger' : ''}`}>{soc}%</span>
        </div>
        <div className="hud-metric">
          <span className="hud-metric-label"><Zap size={11} /> Potencia DC</span>
          <span className="hud-metric-val">{vehiculo?.potencia_carga_max_kW || 135} <small>kW</small></span>
        </div>
      </div>
    </div>
  );
}
