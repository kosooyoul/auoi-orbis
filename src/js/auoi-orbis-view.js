function evalWithinContext(context, code) {(function(code) {eval(code);}).call(context, code);}

if (!window.URL) {
	window.URL = {};
	window.URL.revokeObjectURL = function() {
		// Do nothing
	};
	window.URL.createObjectURL = function() {
		// Do nothing
	};
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

(function() {
	var clazz = {};
	var _objects = {};

	clazz.get = function (name) {
		return _objects[name];
	};

	clazz.constructor = function(element) {
		this.element = element;
		this.src = element.getAttribute('data-src');
		this.jsonp = element.getAttribute('data-jsonp');
		this.prop = {
			angleX: Number(element.getAttribute('data-anglex')),
			angleY: Number(element.getAttribute('data-angley')),
			fov: Number(element.getAttribute('data-fov')),
			onload: element.getAttribute('data-onload')
		};

		this.isLoading = false;

		try {
			if (!window.WebGLRenderingContext) throw new Error('WebGLRenderingContext is undefined.');
			this.renderer = new THREE.WebGLRenderer({antialias: false})
			this.webGLContext = this.renderer.getContext();
		} catch(e) {
			this.renderer = new THREE.CanvasRenderer(); // Fallback to canvas renderer, if necessary.
			this.webGLContext = null;
		}
		this.renderer.setSize(element.clientWidth, element.clientHeight); // Set the size of the WebGL viewport.
		this.renderer.setClearColor(0xF9F9F9, 1);
		this.element.appendChild(this.renderer.domElement); // Append the WebGL viewport to the DOM.

		this.scene = new THREE.Scene(); // Create a Three.js scene object.
		this.camera = new THREE.PerspectiveCamera(60, element.clientWidth / element.clientHeight, 0.1, 1000); // Define the perspective camera's attributes.

		this.sphere = new THREE.Group();
		this.scene.add(this.sphere);

		this.meshForSphere = getMeshForSphere();
		this.meshForSphere.visible = false;
		this.sphere.add(this.meshForSphere);

		this.meshForReady = getMeshForReady();
		this.meshForReady.visible = true;
		this.sphere.add(this.meshForReady);

		/*
		this.meshForLoading = getMeshForLoading();
		this.meshForLoading.visible = false;
		this.sphere.add(this.meshForLoading);
		*/

		initializeDefault(this);

		loadData(this);
	};

	function getMeshForSphere() {
		var geometry = new THREE.SphereGeometry(100, 40, 40, 0, Math.PI * 2, 0, Math.PI * 2);
		var material = new THREE.MeshBasicMaterial({color: 0x000000, overdraw: true});
		return new THREE.Mesh(geometry, material);
	}

	function getMeshForReady() {
		var geometry = new THREE.SphereGeometry(100, 40, 40, 0, Math.PI * 2, 0, Math.PI * 2);
		var material = new THREE.MeshBasicMaterial({color: 0xE0E0E0, wireframe: true, side: THREE.DoubleSide});
		return new THREE.Mesh(geometry, material);
	}

	/*
	function getMeshForLoading() {
		var geometry = new THREE.CylinderGeometry(90, 90, 2, 40, 1, true);
		var texture = new THREE.Texture(generateGradient('#00C8FF', '#FFC800', '#00C8FF', 16, 1));
		texture.needsUpdate = true;
		var material = new THREE.MeshBasicMaterial({map: texture, overdraw: true, side: THREE.DoubleSide});
		return new THREE.Mesh(geometry, material);
	}
	*/

	clazz.constructor.prototype.loadFromFile = function(file) {
		var obj = this;
		var reader  = new FileReader();

        reader.addEventListener('load', function () {
			obj.loadFromDataURI(reader.result);
		}, false);

		reader.readAsDataURL(file);
	};

	clazz.constructor.prototype.loadFromDataURI = function(uri) {
		this.src = uri;
		loadData(this);
	};

	clazz.constructor.prototype.getFile = function() {
		if (!this.downloadable || !this.src) return false;

		var downloader = document.createElement('a');

		var blob = dataURIToBlob(this.src);
		downloader.href = URL.createObjectURL(blob);
		downloader.download = this.filename;
		downloader.onclick = function() {
			setTimeout(function() {
				URL.revokeObjectURL(downloader.href);
			}, 10000);
		};

		downloader.click();

		return true;
	};

    clazz.constructor.prototype.setSize = function(width, height) {
		this.renderer.setSize(width, height); // Set the size of the WebGL viewport.

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

	var loadData = function(obj) {
		obj.name = obj.name || 'Untitled';
		obj.downloadable = !!obj.downloadable;
		obj.filename = obj.filename || 'orbis.png';

		if (obj.angle) {
			obj.angle = {'x': obj.angle.x || 0, 'y': obj.angle.y || 0};
		} else {
			obj.angle = {'x': 0, 'y': 0};
		}
		obj.fov = obj.fov || 60;
		obj.magiceye = obj.magiceye; //[null = none, sbs, tb]

		//override prop
		if (isFinite(obj.prop.angleX)) {
			obj.angle.x = obj.prop.angleX || 0;
			console.log('obj.angle.x', obj.angle.x);
		}
		if (isFinite(obj.prop.angleY)) {
			obj.angle.y = obj.prop.angleY || 0;
			console.log('obj.angle.y', obj.angle.y);
		}
		if (isFinite(obj.prop.fov)) {
			obj.fov = obj.prop.fov || 60;
			console.log('obj.fov', obj.fov);
		}

		if (obj.src) {
			initialize(obj);
		} else if (obj.jsonp) {
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = obj.jsonp;
			
			window.jsonp = function(jso) {
				window.jsonp = null;
				obj.src = jso.data;
				initialize(obj);
				obj.isLoading = false;

				var code = obj.prop.onload;
				if (window[obj.prop.onload] instanceof Function) {
					window[obj.prop.onload].call(obj);
				} else {
					evalWithinContext(obj, code);
				}
			};
			obj.isLoading = true;

			document.head.appendChild(script);
		}
	};

	var initializeDefault = function(obj) {
		initializeEvents(obj);
		initializeRenderLoop(obj);
	};

	var initialize = function(obj) {
		initializeMaterial(obj);
		initializeCamera(obj);

		obj.sphere.rotation.x = obj.angle.x * Math.PI / 180;
		obj.sphere.rotation.y = obj.angle.y * Math.PI / 180;
		obj.camera.fov = obj.fov;
		obj.camera.updateProjectionMatrix();
	};

	var initializeCamera = function(obj) {
		obj.camera.position.z = 0; // Move the camera away from the origin, down the positive z-axis.
	};

	var initializeMaterial = function(obj) {
		var texture = new THREE.TextureLoader().load(obj.src);
		texture.onUpdate = function() {
			//Completed
		};
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(-1, -2);

		if (!obj.downloadable) {
			obj.src = null;
		}

		var material = new THREE.MeshBasicMaterial({map: texture, overdraw: true}); // Skin the cube with 100% blue.
		obj.meshForSphere.material = material;

		obj.meshForSphere.visible = true;
		obj.meshForReady.visible = false;
	};

	var initializeRenderLoop = function(obj) {
		var render = function() {
			/*
			obj.meshForLoading.visible = obj.isLoading;
			if (obj.isLoading) {
				obj.meshForLoading.rotation.y -= Math.PI / 40;
			}
			*/

			obj.renderer.render(obj.scene, obj.camera); // Each time we change the position of the cube object, we must re-render it.
			
			if (obj.webGLContext && obj.webGLContext.getError()) {
				//If error is occured, change renderer to canvas renderer.
				obj.webGLContext = null;
				obj.renderer.domElement.remove();

				obj.renderer = new THREE.CanvasRenderer();
                obj.renderer.setSize(element.clientWidth, element.clientHeight); // Set the size of the WebGL viewport.
				obj.renderer.setClearColor(0xF9F9F9, 1);
				obj.element.appendChild(obj.renderer.domElement); // Append the WebGL viewport to the DOM.
			}

			requestAnimFrame(render); // Call the render() function up to 60 times per second (i.e., up to 60 animation frames per second).
		};
		render();
	};

	var initializeEvents = function(obj) {
		var dragging = false;
		var startX = 0;
		var startY = 0;
		var rx, ry;

		var onDown = function(e) {
			if (obj.element != e.target) {
				if (!~Array.prototype.indexOf.call(obj.element.childNodes, e.target)) {
					return;
				}
			}

			if (e.type == 'touchstart') {
				e.preventDefault();//for Mobile
			}

			if (e.target != obj.renderer.domElement) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			dragging = true;
			startX = pointer.pageX;
			startY = pointer.pageY;
		};

		var onMove = function(e) {
			if (!dragging) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			rx = obj.sphere.rotation.x - (pointer.pageY - startY) / 360;
			ry = obj.sphere.rotation.y - (pointer.pageX - startX) / 360;

			if (rx < -Math.PI / 2) rx = -Math.PI / 2;
			else if (rx > Math.PI / 2) rx = Math.PI / 2;

			obj.sphere.rotation.x = rx;
			obj.sphere.rotation.y = ry;

			if (window['__DEBUG_MODE__']) {
				console.log('rotateX: ' + (rx / Math.PI * 180) + ', rotateY: ' + (ry / Math.PI * 180) + ', fovy: ' + obj.camera.fov);
			}

			startX = pointer.pageX;
			startY = pointer.pageY;

			//if (window.console) {
			//	console.log(rx / 3.14 * 180, ry / 3.14 * 180);
			//}
		};
	
		var onUp = function(e) {
			dragging = false;
		};

		window.addEventListener('mousedown', onDown, false);
		window.addEventListener('mousemove', onMove, false);
		window.addEventListener('mouseup', onUp, false);
		obj.element.addEventListener('touchstart', onDown);
		obj.element.addEventListener('touchmove', onMove);
		obj.element.addEventListener('touchend', onUp);
		window.addEventListener('wheel', function(e) {
			if (e.deltaY < 0) {
				obj.fov = Math.max(obj.fov - 1, 10);
			} else if (e.deltaY > 0) {
				obj.fov = Math.min(obj.fov + 1, 120);
			}
			obj.camera.fov = obj.fov;
			obj.camera.updateProjectionMatrix();
		}, false);

		window.addEventListener('drop', function(e) {
			if (obj.element != e.target) {
				if (!~Array.prototype.indexOf.call(obj.element.childNodes, e.target)) {
					return;
				}
			}
			obj.loadFromFile(e.dataTransfer.files[0]);
			e.preventDefault();
		}, false);
		window.addEventListener('dragover', function(e) {
			e.preventDefault();
		}, false);
	};

	/*
	var generateGradient = function(start, center, end, width, height) {
		var w = width || 512;
		var h = height || 512;

		// create canvas
		canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;

		// get context
		var context = canvas.getContext('2d');

		// draw gradient
		context.rect(0, 0, w, h);
		var gradient = context.createLinearGradient(0, 0, w, h);
		gradient.addColorStop(0, start);
		gradient.addColorStop(0.5, center);
		gradient.addColorStop(1, end);
		context.fillStyle = gradient;
		context.fill();

		return canvas;
	};
	*/

	function dataURIToBlob(dataURI) {
		var binStr = atob(dataURI.split(',')[1]), len = binStr.length, arr = new Uint8Array(len), mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

		for (var i = 0; i < len; i++) {
			arr[i] = binStr.charCodeAt(i);
		}

		return new Blob([arr], {type: mimeString});
	}

	window.AuoiOrbisView = clazz;
	window.addEventListener('load', function() {
		var elements = document.querySelectorAll('[data-view=\'auoi-orbis-view\']');
		var i, name, obj;
		for (i = 0; i < elements.length; i++) {
			obj = new clazz.constructor(elements[i]);

			name = elements[i].getAttribute('name');
			if (name) {
				_objects[name] = obj;
			}
			
		}
	});
})();