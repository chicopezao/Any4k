const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// URL base da API any4k
const ANY4K_API_BASE = 'https://api.any4k.com/v1/dlp';

// Middleware
app.use(cors());
app.use(express.json());

// Função auxiliar para obter informações do vídeo
async function getVideoInfo(videoUrl, lang = 'pt', country = 'BR') {
    const payload = {
        url: videoUrl,
        lang: lang,
        country: country,
        platform: 'Web',
        deviceId: uuidv4().replace(/-/g, ''),
        sysVer: '1.0.0',
        appVer: '1.0.0',
        bundleId: 'com.any4k.api'
    };

    try {
        const response = await axios.post(`${ANY4K_API_BASE}/check`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        return response;
    } catch (error) {
        throw error;
    }
}

// Função auxiliar para fazer download
async function downloadMedia(videoUrl, formatId, lang = 'pt', country = 'BR') {
    const payload = {
        url: videoUrl,
        format: formatId,
        lang: lang,
        country: country
    };

    try {
        const response = await axios.post(`${ANY4K_API_BASE}/download`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000,
            responseType: 'stream'
        });
        return response;
    } catch (error) {
        throw error;
    }
}

// Rota para baixar música/áudio
app.get('/musica', async (req, res) => {
    try {
        const { url, quality = 'best' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/musica?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`🎵 Processando download de música: ${url}`);

        // Obter informações do vídeo
        const infoResponse = await getVideoInfo(url);
        
        if (infoResponse.status !== 200) {
            return res.status(infoResponse.status).json({
                error: 'Erro ao obter informações do vídeo',
                message: infoResponse.data
            });
        }

        const infoData = infoResponse.data;
        let formatId = null;

        // Procurar formato de áudio
        if (infoData.data && typeof infoData.data === 'object') {
            const audioFormats = infoData.data.raw_audio || [];
            
            if (audioFormats.length > 0) {
                // Escolher formato baseado na qualidade
                if (quality === 'best') {
                    formatId = audioFormats[0].id; // Primeiro formato (melhor qualidade)
                } else if (quality === 'worst') {
                    formatId = audioFormats[audioFormats.length - 1].id; // Último formato
                } else {
                    // Procurar por qualidade específica
                    const specificFormat = audioFormats.find(fmt => 
                        fmt.res_text && fmt.res_text.toLowerCase().includes(quality.toLowerCase())
                    );
                    formatId = specificFormat ? specificFormat.id : audioFormats[0].id;
                }
            }
        }

        if (!formatId) {
            return res.status(404).json({
                error: 'Nenhum formato de áudio disponível',
                message: 'Não foi possível encontrar formatos de áudio para este vídeo',
                info: infoData
            });
        }

        console.log(`🎵 Baixando áudio com formato: ${formatId}`);

        // Fazer download
        const downloadResponse = await downloadMedia(url, formatId);

        if (downloadResponse.status !== 200) {
            return res.status(downloadResponse.status).json({
                error: 'Erro no download',
                message: 'Falha ao baixar o áudio'
            });
        }

        // Determinar nome do arquivo
        let filename = `musica_${formatId}`;
        const contentType = downloadResponse.headers['content-type'] || '';
        
        if (contentType.includes('audio/mpeg')) {
            filename += '.mp3';
        } else if (contentType.includes('audio/mp4') || contentType.includes('audio/m4a')) {
            filename += '.m4a';
        } else if (contentType.includes('audio/webm')) {
            filename += '.webm';
        } else {
            filename += '.m4a'; // padrão
        }

        // Configurar headers para download
        res.setHeader('Content-Type', contentType || 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (downloadResponse.headers['content-length']) {
            res.setHeader('Content-Length', downloadResponse.headers['content-length']);
        }

        console.log(`✅ Enviando áudio: ${filename}`);

        // Fazer pipe do stream de download para a resposta
        downloadResponse.data.pipe(res);

    } catch (error) {
        console.error('Erro no download de música:', error.message);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                error: 'Timeout',
                message: 'A requisição demorou muito para responder'
            });
        }

        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
});

// Rota para baixar clipe/vídeo
app.get('/clipe', async (req, res) => {
    try {
        const { url, quality = 'best' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/clipe?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`🎬 Processando download de clipe: ${url}`);

        // Obter informações do vídeo
        const infoResponse = await getVideoInfo(url);
        
        if (infoResponse.status !== 200) {
            return res.status(infoResponse.status).json({
                error: 'Erro ao obter informações do vídeo',
                message: infoResponse.data
            });
        }

        const infoData = infoResponse.data;
        let formatId = null;

        // Procurar formato de vídeo
        if (infoData.data && typeof infoData.data === 'object') {
            const videoFormats = infoData.data.download || infoData.data.raw_video || [];
            
            if (videoFormats.length > 0) {
                // Escolher formato baseado na qualidade
                if (quality === 'best') {
                    formatId = videoFormats[0].id; // Primeiro formato (melhor qualidade)
                } else if (quality === 'worst') {
                    formatId = videoFormats[videoFormats.length - 1].id; // Último formato
                } else {
                    // Procurar por qualidade específica (720p, 1080p, etc.)
                    const specificFormat = videoFormats.find(fmt => 
                        fmt.res_text && fmt.res_text.toLowerCase().includes(quality.toLowerCase())
                    );
                    formatId = specificFormat ? specificFormat.id : videoFormats[0].id;
                }
            }
        }

        if (!formatId) {
            return res.status(404).json({
                error: 'Nenhum formato de vídeo disponível',
                message: 'Não foi possível encontrar formatos de vídeo para este clipe',
                info: infoData
            });
        }

        console.log(`🎬 Baixando vídeo com formato: ${formatId}`);

        // Fazer download
        const downloadResponse = await downloadMedia(url, formatId);

        if (downloadResponse.status !== 200) {
            return res.status(downloadResponse.status).json({
                error: 'Erro no download',
                message: 'Falha ao baixar o vídeo'
            });
        }

        // Determinar nome do arquivo
        let filename = `clipe_${formatId}`;
        const contentType = downloadResponse.headers['content-type'] || '';
        
        if (contentType.includes('video/mp4')) {
            filename += '.mp4';
        } else if (contentType.includes('video/webm')) {
            filename += '.webm';
        } else if (contentType.includes('video/avi')) {
            filename += '.avi';
        } else {
            filename += '.mp4'; // padrão
        }

        // Configurar headers para download
        res.setHeader('Content-Type', contentType || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (downloadResponse.headers['content-length']) {
            res.setHeader('Content-Length', downloadResponse.headers['content-length']);
        }

        console.log(`✅ Enviando vídeo: ${filename}`);

        // Fazer pipe do stream de download para a resposta
        downloadResponse.data.pipe(res);

    } catch (error) {
        console.error('Erro no download de clipe:', error.message);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                error: 'Timeout',
                message: 'A requisição demorou muito para responder'
            });
        }

        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
});

// Rota de informações da API
app.get('/info', (req, res) => {
    res.json({
        name: 'Any4K Express API',
        version: '1.0.0',
        description: 'API Express para download de músicas e clipes usando any4k.com',
        endpoints: {
            '/musica': {
                method: 'GET',
                description: 'Baixar áudio/música de um vídeo',
                parameters: {
                    url: 'URL do vídeo (obrigatório)',
                    quality: 'best, worst ou qualidade específica (opcional, padrão: best)'
                },
                exemplo: '/musica?url=https://www.youtube.com/watch?v=VIDEO_ID'
            },
            '/clipe': {
                method: 'GET',
                description: 'Baixar vídeo/clipe',
                parameters: {
                    url: 'URL do vídeo (obrigatório)',
                    quality: 'best, worst, 720p, 1080p, etc. (opcional, padrão: best)'
                },
                exemplo: '/clipe?url=https://www.youtube.com/watch?v=VIDEO_ID'
            },
            '/info': {
                method: 'GET',
                description: 'Informações sobre a API'
            }
        },
        supported_platforms: [
            'YouTube',
            'TikTok',
            'Twitter',
            'Instagram',
            'Facebook',
            'Vimeo',
            'Dailymotion'
        ]
    });
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        message: 'Any4K Express API - Servidor funcionando!',
        endpoints: [
            'GET /musica?url=VIDEO_URL - Baixar música/áudio',
            'GET /clipe?url=VIDEO_URL - Baixar vídeo/clipe',
            'GET /info - Informações da API'
        ],
        exemplo_uso: {
            musica: `${req.protocol}://${req.get('host')}/musica?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
            clipe: `${req.protocol}://${req.get('host')}/clipe?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`
        }
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Any4K Express rodando na porta ${PORT}`);
    console.log(`📱 Endpoints disponíveis:`);
    console.log(`   GET /musica?url=VIDEO_URL - Baixar música/áudio`);
    console.log(`   GET /clipe?url=VIDEO_URL - Baixar vídeo/clipe`);
    console.log(`   GET /info - Informações da API`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
});

module.exports = app;

