const express = require("express");
const axios = require("axios");
const yts = require("yt-search");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const ANY4K_API_BASE = "https://api.any4k.com/v1/dlp";

// habilita CORS
app.use(cors());

// função auxiliar: busca vídeo no YouTube
const searchYouTube = async (query) => {
  const result = await yts(query);
  return result.videos.length ? result.videos[0] : null;
};

// função auxiliar: chama API any4k
const getVideoInfo = async (url) => {
  const payload = { url, lang: "pt", country: "BR" };
  return axios.post(`${ANY4K_API_BASE}/check`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
  });
};

// 🎵 rota musica (pega áudio do YouTube)
app.get("/api/musica", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório (nome da música)" });

  try {
    const video = await searchYouTube(q);
    if (!video) return res.status(404).json({ error: "Nenhum vídeo encontrado no YouTube" });

    const info = await getVideoInfo(video.url);
    const data = info.data?.data;

    if (!data || !data.raw_audio?.length) {
      return res.status(404).json({ error: "Nenhum áudio disponível" });
    }

    const audio = data.raw_audio[0];
    res.json({
      success: true,
      type: "musica",
      title: video.title,
      author: video.author?.name,
      duration: video.timestamp,
      thumbnail: video.thumbnail,
      youtubeUrl: video.url,
      downloadUrl: audio.url,
      format: audio.res_text || "mp3/m4a",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🎬 rota clipe (pega vídeo do YouTube)
app.get("/api/clipe", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório (nome do vídeo)" });

  try {
    const video = await searchYouTube(q);
    if (!video) return res.status(404).json({ error: "Nenhum vídeo encontrado no YouTube" });

    const info = await getVideoInfo(video.url);
    const data = info.data?.data;

    if (!data || !(data.download?.length || data.raw_video?.length)) {
      return res.status(404).json({ error: "Nenhum vídeo disponível" });
    }

    const clip = data.download?.[0] || data.raw_video?.[0];
    res.json({
      success: true,
      type: "clipe",
      title: video.title,
      author: video.author?.name,
      duration: video.timestamp,
      thumbnail: video.thumbnail,
      youtubeUrl: video.url,
      downloadUrl: clip.url,
      quality: clip.res_text || "desconhecida",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// rota info
app.get("/", (req, res) => {
  res.json({
    name: "API Música & Clipe",
    version: "1.0.0",
    endpoints: {
      musica: "/api/musica?q=NOME_DA_MUSICA",
      clipe: "/api/clipe?q=NOME_DO_VIDEO",
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
