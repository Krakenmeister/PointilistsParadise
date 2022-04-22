const imageSelect = document.getElementById('imageSelect');
let canvas = document.getElementById('imageCanvas');
let ctx = canvas.getContext('2d');

imageSelect.addEventListener('change', handleMedia, false);
imageSelect.addEventListener('click', clearImage, false);

function sigmoid (x) {
	return 0.95 - (0.9 / (1 + Math.exp(-12 * (x/255 - 0.5))));
}

function sigmoid2 (x) {
	return 1.01 - (1.02 / (1 + Math.exp(-12 * (x/255 - 0.5))));
}

function clearImage () {
	this.value = null;
}

function drawDots (ctx, color, precision, width, height) {
	let imgData = ctx.getImageData(0, 0, width, height);
	let probabilitySpace = 0;
	let probabilityDistribution = [];
	for (let i=0; i<imgData.data.length; i+=4) {
		let grayscale;
		if (color) {
			grayscale = sigmoid((0.299 * imgData.data[i]) + (0.587 * imgData.data[i+1]) + (0.114 * imgData.data[i+2]));
		} else {
			grayscale = sigmoid2((0.299 * imgData.data[i]) + (0.587 * imgData.data[i+1]) + (0.114 * imgData.data[i+2]));
		}
		probabilitySpace += grayscale;
		let inputSpace = [probabilitySpace, ((i/4) % width), ((i/4) / width)];
		probabilityDistribution.push(inputSpace);
	}

	ctx.fillStyle = "#FFFFFF";
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = "#000000";

	let factor = 1 + (20 / ((precision / 20) + 0.2));
	let numDots = probabilitySpace / factor;
	if (color) {
		numDots *= 2;
	}

	for (let i=0; i<numDots; i++) {
		let randomDot = Math.random() * probabilitySpace;
		let low = 0;
		let high = probabilityDistribution.length;
		let guess = Math.floor((high + low) / 2);
		while (true) {
			if (guess == 0) {
				if (color) {
					ctx.fillStyle = `rgb(${imgData.data[0]}, ${imgData.data[1]}, ${imgData.data[2]})`;
				}
				ctx.beginPath();
				ctx.arc(0, 0, 2, 0, 2 * Math.PI);
				ctx.fill();
				break;
			} else if (!(randomDot < probabilityDistribution[guess][0])) {
				low = guess;
				guess = Math.floor((high + low) / 2);
			} else if (!(randomDot > probabilityDistribution[guess-1][0])) {
				high = guess;
				guess = Math.floor((high + low) / 2);
			} else {
				if (color) {
					ctx.fillStyle = `rgb(${imgData.data[4*guess]}, ${imgData.data[4*guess+1]}, ${imgData.data[4*guess+2]})`;
				}
				ctx.beginPath();
				ctx.arc(probabilityDistribution[guess][1] + Math.random(), probabilityDistribution[guess][2] + Math.random(), 2, 0, 2 * Math.PI);
				ctx.fill();
				break;
			}
		}
	}
	return ctx;
}

function handleMedia (e) {
	if (e.target.files[0] && e.target.files[0]['type'].split('/')[0] === 'image') {
		let reader = new FileReader();
		reader.onload = function (event) {
			let img = new Image();
			img.onload = function () {
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);

				const color = document.getElementById('imageColor').checked;
				const precision = document.getElementById('imagePrecision').value;

				ctx = drawDots(ctx, color, precision, canvas.width, canvas.height);
				canvas.style.zoom = Math.min((window.screen.width - 50) / canvas.width, (window.screen.height - 150) / canvas.height);
			}
			img.src = event.target.result;
		}
		reader.readAsDataURL(e.target.files[0]);
	} else {
		let fileURL = window.URL.createObjectURL(e.target.files[0]);
		handleVideo(fileURL);
	}
}

async function extractFramesFromVideo(videoObjectUrl, fps) {
	return new Promise(async (resolve) => {
		let video = document.createElement("video");

		let seekResolve;
		video.addEventListener('seeked', async function() {
			if (seekResolve){
				seekResolve();
			}
		});

		video.src = videoObjectUrl;
		video.setAttribute('crossOrigin', '');

		// workaround chromium metadata bug (https://stackoverflow.com/q/38062864/993683)
		while((video.duration === Infinity || isNaN(video.duration)) && video.readyState < 2) {
			await new Promise(r => setTimeout(r, 1000));
			video.currentTime = 10000000*Math.random();
		}
		let duration = video.duration;

		let tempcanvas = document.createElement('canvas');
		let tempctx = tempcanvas.getContext('2d');
		let [w, h] = [video.videoWidth, video.videoHeight]
		tempcanvas.width =  w;
		tempcanvas.height = h;

		let frames = [];
		let interval = 1 / fps;
		let currentTime = 0;

		const color = document.getElementById('imageColor').checked;
		const precision = document.getElementById('imagePrecision').value;
		const progressBar = document.getElementById('progressBar');

		while(currentTime < duration) {
			progressBar.innerHTML = `Progress: ${Math.floor(100 * currentTime / duration)}%`;
			video.currentTime = currentTime;
			await new Promise(r => seekResolve=r);

			tempctx.drawImage(video, 0, 0, w, h);
			tempctx = drawDots(tempctx, color, precision, w, h);
			let base64ImageData = tempcanvas.toDataURL();
			frames.push(base64ImageData);

			currentTime += interval;
		}
		resolve(frames);
	});
}

function drawDataURIOnCanvas(strDataURI, canvas) {
	var img = new window.Image();
	img.addEventListener("load", function () {
		canvas.width = img.width;
		canvas.height = img.height;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(img, 0, 0, img.width, img.height);
		canvas.style.zoom = Math.min((window.screen.width - 50) / canvas.width, (window.screen.height - 150) / canvas.height);
	});

	img.src = strDataURI;
}

const timer = ms => new Promise(res => setTimeout(res, ms));
async function handleVideo (videoURL) {
	const fps = document.getElementById('videoFPS').value;
	let frames = await extractFramesFromVideo(videoURL, fps);
	document.getElementById('progressBar').innerHTML = '';
	for (let i=0; i<frames.length; i++) {
		drawDataURIOnCanvas(frames[i], canvas);
		await timer(1000/fps);
	}
}
