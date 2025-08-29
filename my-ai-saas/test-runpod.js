// Simple RunPod -> ComfyUI connectivity test for text-to-image
// Usage: node test-runpod.js "your prompt here" (optional)

const DEFAULT_URL = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || "https://9wc6zqlr5p7i6a-3001.proxy.runpod.net/";
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const PROMPT_TEXT = process.argv.slice(2).join(" ") || "a cute corgi playing in a park, high detail, natural lighting";

function headers() {
	return {
		"Content-Type": "application/json",
		...(RUNPOD_API_KEY ? { Authorization: `Bearer ${RUNPOD_API_KEY}` } : {}),
		...(RUNPOD_API_KEY ? { "x-api-key": RUNPOD_API_KEY } : {}),
	};
}

async function pickCheckpoint(base) {
	const r = await fetch(base.replace(/\/$/, "") + "/object_info", { headers: headers() });
	const data = await r.json();
	const ckptNode = data?.CheckpointLoaderSimple;
	const options = ckptNode?.input?.required?.ckpt_name?.[0] || [];
	// Prefer SDXL-like checkpoints and avoid Flux for this simple graph
	const preferRe = [/sdxl/i, /sd_xl/i, /xl/i, /realistic/i, /juggernaut/i];
	for (const re of preferRe) {
		const match = options.find((o) => re.test(String(o)) && !/flux/i.test(String(o)));
		if (match) return String(match);
	}
	// Fallback to first non-flux option
	const nonFlux = options.find((o) => !/flux/i.test(String(o)));
	return String(nonFlux || options[0] || "");
}

function buildGraph(ckptName, prompt) {
	// Minimal, robust SD/SDXL graph
	return {
		1: {
			inputs: { ckpt_name: ckptName },
			class_type: "CheckpointLoaderSimple",
		},
		2: {
			inputs: { text: prompt, clip: [1, 1] },
			class_type: "CLIPTextEncode",
		},
		3: {
			inputs: { text: "", clip: [1, 1] },
			class_type: "CLIPTextEncode",
		},
		4: {
			inputs: { width: 512, height: 512, batch_size: 1 },
			class_type: "EmptyLatentImage",
		},
		5: {
			inputs: {
				seed: Math.floor(Math.random() * 1e9),
				steps: 15,
				cfg: 4.5,
				sampler_name: "euler",
				scheduler: "normal",
				denoise: 1,
				model: [1, 0],
				positive: [2, 0],
				negative: [3, 0],
				latent_image: [4, 0],
			},
			class_type: "KSampler",
		},
		6: {
			inputs: { samples: [5, 0], vae: [1, 2] },
			class_type: "VAEDecode",
		},
		7: {
			inputs: { images: [6, 0] },
			class_type: "SaveImage",
		},
	};
}

async function submitPrompt(base, graph) {
	const r = await fetch(base.replace(/\/$/, "") + "/prompt", {
		method: "POST",
		headers: headers(),
		body: JSON.stringify({ prompt: graph, client_id: "test-runpod-script" }),
	});
	if (!r.ok) throw new Error(`/prompt failed: ${r.status}`);
	const data = await r.json();
	const promptId = data?.prompt_id || data?.promptId || data?.id;
	if (!promptId) throw new Error("No prompt_id in response");
	return String(promptId);
}

async function pollHistory(base, promptId, timeoutMs = 120000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const r = await fetch(base.replace(/\/$/, "") + "/history/" + promptId, { headers: headers() });
		if (r.ok) {
			const data = await r.json();
			const outputs = data?.[promptId]?.outputs || data?.outputs || data;
			if (outputs) return outputs;
		}
		await new Promise((res) => setTimeout(res, 1500));
	}
	throw new Error("Timed out waiting for history");
}

function extractViewUrls(base, outputs) {
	const images = [];
	for (const nodeId in outputs) {
		const node = outputs[nodeId];
		const imgs = node?.images || [];
		for (const im of imgs) {
			const path = (im.subfolder ? `${im.subfolder}/` : "") + im.filename;
			images.push(base.replace(/\/$/, "") + "/view?filename=" + encodeURIComponent(path));
		}
	}
	return images;
}

(async () => {
	try {
		const base = DEFAULT_URL;
		console.log("RunPod base:", base);
		console.log("Prompt:", PROMPT_TEXT);
		const ckpt = await pickCheckpoint(base);
		if (!ckpt) throw new Error("No checkpoints found on /object_info");
		console.log("Using checkpoint:", ckpt);
		const graph = buildGraph(ckpt, PROMPT_TEXT);
		const promptId = await submitPrompt(base, graph);
		console.log("prompt_id:", promptId);
		const outputs = await pollHistory(base, promptId);
		const urls = extractViewUrls(base, outputs);
		console.log("Image URLs:");
		for (const u of urls) console.log("-", u);
		if (!urls.length) throw new Error("No images found in history outputs");
		console.log("SUCCESS");
	} catch (err) {
		console.error("Test failed:", err?.message || err);
		process.exit(1);
	}
})();

