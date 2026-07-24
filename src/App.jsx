import { useEffect, useRef } from "react";
import * as THREE from "three";

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.BoxGeometry(0.5, 2, 3);
    const material = new THREE.MeshBasicMaterial({
      color: "#FFBF00",
      wireframe: false,
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.position.x = 1;
    cube.position.y = 1; 
    cube.position.z = -5; 
    scene.add(cube);

    const animate = (time) => {
      console.log("Animation frame time:", time);
      cube.rotation.x = time * 0.001;
      cube.rotation.y = time * 0.001;
      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      renderer.setAnimationLoop(null);

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} />;
}

export default App;