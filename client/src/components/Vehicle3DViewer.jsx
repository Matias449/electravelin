import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCw, BatteryCharging, Gauge, Zap, Box, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

/**
 * Vehicle3DViewer — Renderizador de modelos 3D reales de vehículos eléctricos (GLTF/GLB)
 * Identifica de forma explícita si el vehículo seleccionado cuenta con un modelo 3D real
 * o si se muestra en modo ficha técnica digital 2D.
 */
export default function Vehicle3DViewer({ vehiculo, soc = 80, isCharging = false, onSelectRealModel }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);

  const hasReal3D = Boolean(vehiculo?.tieneModelo3D && vehiculo?.modelo3DUrl);

  useEffect(() => {
    if (!hasReal3D) return;

    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 400;
    const height = 260;

    // 1. Escena & Cámara
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.5, 2.2, 4.5);

    // 2. Renderer WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    // 3. Luces de estudio automotriz
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00d4ff, 1.5);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    // Piso reflectante suave
    const floorGeo = new THREE.CircleGeometry(3.5, 36);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.7,
      metalness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.01;
    scene.add(floor);

    // 4. Carga del Modelo 3D Real (GLTF / GLB)
    const loader = new GLTFLoader();
    let carModel = null;
    let animationFrameId = null;
    const carContainer = new THREE.Group();
    scene.add(carContainer);

    setLoadingModel(true);
    setLoadProgress(0);
    setLoadError(null);

    loader.load(
      vehiculo.modelo3DUrl,
      (gltf) => {
        carModel = gltf.scene;

        // Calcular BoundingBox para centrar y escalar uniformemente
        const box = new THREE.Box3().setFromObject(carModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Escalar a aprox 3.6 unidades de longitud
        const maxAxis = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3.6 / maxAxis;
        carModel.scale.setScalar(scaleFactor);

        // Centrar geométricamente sobre el piso
        carModel.position.x = -center.x * scaleFactor;
        carModel.position.y = -box.min.y * scaleFactor;
        carModel.position.z = -center.z * scaleFactor;

        carContainer.add(carModel);
        setLoadingModel(false);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadProgress(percent);
        }
      },
      (error) => {
        console.error('Error cargando modelo 3D GLB:', error);
        setLoadingModel(false);
        setLoadError('No fue posible cargar el archivo 3D GLB.');
      }
    );

    camera.lookAt(0, 0.6, 0);

    // 5. Interacción de Arrastre (Orbit)
    let isDragging = false;
    let prevX = 0;
    const onMouseDown = (e) => {
      isDragging = true;
      prevX = e.clientX;
    };
    const onMouseMove = (e) => {
      if (!isDragging || !carContainer) return;
      const deltaX = e.clientX - prevX;
      carContainer.rotation.y += deltaX * 0.01;
      prevX = e.clientX;
    };
    const onMouseUp = () => { isDragging = false; };

    mount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Loop de animación
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (autoRotate && !isDragging && carContainer) {
        carContainer.rotation.y += 0.006;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Redimensionamiento
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
  }, [hasReal3D, vehiculo?.modelo3DUrl]);

  // Telemetría
  const capKwh = vehiculo?.bateriaUtilizable_kWh || vehiculo?.bateria_util_kWh || 75;
  const consumoMedio = vehiculo?.consumoReferencia_kWhPor100km || vehiculo?.consumo_medio_kWh_100km || 15;
  const autonomiaTeoricaKm = Math.round(((capKwh * (soc / 100)) / consumoMedio) * 100);

  // ─── Render si el vehículo NO tiene modelo 3D real ────────────────────────
  if (!hasReal3D) {
    return (
      <div className="vehicle-3d-card" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div className="vehicle-3d-header">
          <div className="vehicle-3d-title-group">
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              <Box size={13} /> FICHA TÉCNICA 2D · SIN MODELO 3D
            </span>
            <h4 className="vehicle-3d-model-name" style={{ color: '#fff' }}>
              {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo Eléctrico'}
            </h4>
          </div>

          {onSelectRealModel && (
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={() => onSelectRealModel('tesla_model3_lr')}
              style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Sparkles size={12} /> Ver Tesla 3D Real
            </button>
          )}
        </div>

        <div style={{
          background: 'rgba(8, 12, 22, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 8,
          padding: '16px',
          margin: '12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <AlertCircle size={22} color="#94a3b8" />
          </div>
          <div>
            <p style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 600, margin: 0 }}>
              Modelo 3D no disponible para este vehículo
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              Actualmente disponemos del <strong>modelo 3D real (GLB)</strong> para <em>Tesla Model 3</em> y <em>Tesla Model Y</em>. Para el resto de los modelos se calculan las rutas con sus fichas técnicas exactas.
            </p>
          </div>
        </div>

        {/* Telemetría en tiempo real */}
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
            <span className="hud-metric-label"><Zap size={11} /> Carga Máx DC</span>
            <span className="hud-metric-val">{vehiculo?.potenciaCargaMaxima_kW || 100} <small>kW</small></span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render si el vehículo SÍ cuenta con modelo 3D real ────────────────────
  return (
    <div className="vehicle-3d-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
      <div className="vehicle-3d-header">
        <div className="vehicle-3d-title-group">
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: '#10b981',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            <CheckCircle2 size={13} color="#10b981" /> MODELO 3D REAL (GLTF/GLB)
          </span>
          <h4 className="vehicle-3d-model-name">
            {vehiculo.marca} {vehiculo.modelo}
          </h4>
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

      {/* Canvas 3D con indicador de carga */}
      <div style={{ position: 'relative', width: '100%', height: 260 }}>
        {loadingModel && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(6, 10, 19, 0.8)',
            zIndex: 10,
            borderRadius: 8,
            gap: 10
          }}>
            <div className="spinner" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#00d4ff' }}>
              Cargando modelo 3D real ({loadProgress}%)…
            </span>
          </div>
        )}

        {loadError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            fontSize: '0.82rem'
          }}>
            {loadError}
          </div>
        )}

        <div
          ref={mountRef}
          className="vehicle-3d-canvas-wrap"
          style={{ height: 260 }}
          title="Arrastra para rotar el Tesla Model 3 en 360°"
        />
      </div>

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
          <span className="hud-metric-val">{vehiculo.potenciaCargaMaxima_kW || 250} <small>kW</small></span>
        </div>
      </div>
    </div>
  );
}
