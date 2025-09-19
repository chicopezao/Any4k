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

// Função auxiliar para obter informações do vídeo (baseada no wrapper Flask)
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

// Função melhorada para encontrar formatos de áudio (baseada no wrapper Flask)
function findAudioFormats(videoData) {
    const audioFormats = [];
    
    if (!videoData) {
        return audioFormats;
    }

    // Verificar raw_audio primeiro (estrutura principal do Flask)
    if (Array.isArray(videoData.raw_audio) && videoData.raw_audio.length > 0) {
        audioFormats.push(...videoData.raw_audio);
    }

    // Verificar outras estruturas possíveis
    const possibleAudioPaths = [
        videoData.audio,
        videoData.formats?.filter(f => f.type === 'audio'),
        videoData.download?.filter(f => f.type === 'audio' || f.format_note?.includes('audio')),
        videoData.formats?.filter(f => f.acodec && f.acodec !== 'none'),
        videoData.download?.filter(f => f.ext === 'mp3' || f.ext === 'm4a' || f.ext === 'webm' || f.ext === 'ogg')
    ];

    // Verificar cada caminho possível
    for (const path of possibleAudioPaths) {
        if (Array.isArray(path) && path.length > 0) {
            audioFormats.push(...path);
        }
    }

    // Se ainda não encontrou, tentar buscar em todos os formatos disponíveis
    if (audioFormats.length === 0 && videoData.download) {
        const allFormats = Array.isArray(videoData.download) ? videoData.download : [];
        for (const format of allFormats) {
            // Verificar se é formato de áudio baseado em várias propriedades
            if (format && (
                format.type === 'audio' ||
                format.format_note?.toLowerCase().includes('audio') ||
                format.ext === 'mp3' ||
                format.ext === 'm4a' ||
                format.ext === 'webm' ||
                format.ext === 'ogg' ||
                (format.acodec && format.acodec !== 'none') ||
                (format.vcodec === 'none' && format.acodec)
            )) {
                audioFormats.push(format);
            }
        }
    }

    // Remover duplicatas baseado no ID
    const uniqueFormats = audioFormats.filter((format, index, self) => 
        index === self.findIndex(f => f.id === format.id)
    );

    return uniqueFormats;
}

// Função melhorada para encontrar formatos de vídeo (baseada no wrapper Flask)
function findVideoFormats(videoData) {
    const videoFormats = [];
    
    if (!videoData) {
        return videoFormats;
    }

    // Verificar download primeiro (estrutura principal do Flask)
    if (Array.isArray(videoData.download) && videoData.download.length > 0) {
        videoFormats.push(...videoData.download);
    }

    // Verificar outras estruturas possíveis
    const possibleVideoPaths = [
        videoData.raw_video,
        videoData.video,
        videoData.formats?.filter(f => f.type === 'video'),
        videoData.formats?.filter(f => f.vcodec && f.vcodec !== 'none')
    ];

    // Verificar cada caminho possível
    for (const path of possibleVideoPaths) {
        if (Array.isArray(path) && path.length > 0) {
            videoFormats.push(...path);
        }
    }

    // Se ainda não encontrou, tentar buscar em todos os formatos disponíveis
    if (videoFormats.length === 0 && videoData.download) {
        const allFormats = Array.isArray(videoData.download) ? videoData.download : [];
        for (const format of allFormats) {
            // Verificar se é formato de vídeo baseado em várias propriedades
            if (format && (
                format.type === 'video' ||
                format.ext === 'mp4' ||
                format.ext === 'webm' ||
                format.ext === 'avi' ||
                format.ext === 'mkv' ||
                (format.vcodec && format.vcodec !== 'none') ||
                (format.height && format.width)
            )) {
                videoFormats.push(format);
            }
        }
    }

    // Remover duplicatas baseado no ID
    const uniqueFormats = videoFormats.filter((format, index, self) => 
        index === self.findIndex(f => f.id === format.id)
    );

    return uniqueFormats;
}

// Função para escolher melhor formato baseado na qualidade
function selectFormat(formats, quality = 'best') {
    if (!formats || formats.length === 0) {
        return null;
    }

    // Ordenar formatos por qualidade
    const sortedFormats = formats.sort((a, b) => {
        // Para áudio, usar bitrate (abr) ou asr
        if (a.abr && b.abr) {
            return b.abr - a.abr;
        }
        if (a.asr && b.asr) {
            return b.asr - a.asr;
        }
        // Para vídeo, usar altura
        if (a.height && b.height) {
            return b.height - a.height;
        }
        // Fallback para filesize
        if (a.filesize && b.filesize) {
            return b.filesize - a.filesize;
        }
        return 0;
    });

    if (quality === 'best') {
        return sortedFormats[0];
    } else if (quality === 'worst') {
        return sortedFormats[sortedFormats.length - 1];
    } else {
        // Procurar por qualidade específica
        const specificFormat = sortedFormats.find(fmt => 
            fmt.res_text && fmt.res_text.toLowerCase().includes(quality.toLowerCase()) ||
            fmt.format_note && fmt.format_note.toLowerCase().includes(quality.toLowerCase()) ||
            fmt.quality && fmt.quality.toString().includes(quality)
        );
        return specificFormat || sortedFormats[0];
    }
}

// Rota para verificar informações e formatos (baseada no wrapper Flask)
app.get('/check', async (req, res) => {
    try {
        const { url, lang = 'pt', country = 'BR' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL do vídeo é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/check?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`🔍 Verificando informações para: ${url}`);

        const infoResponse = await getVideoInfo(url, lang, country);
        
        if (infoResponse.status !== 200) {
            return res.status(infoResponse.status).json({
                error: 'Erro ao obter informações do vídeo',
                message: infoResponse.data
            });
        }

        const infoData = infoResponse.data;
        console.log('📊 Resposta da API:', JSON.stringify(infoData, null, 2));

        // Se a resposta contém dados completos do vídeo
        if (infoData.data && typeof infoData.data === 'object') {
            const videoData = infoData.data;
            
            const audioFormats = findAudioFormats(videoData);
            const videoFormats = findVideoFormats(videoData);

            return res.json({
                success: true,
                video_info: {
                    id: videoData.id,
                    title: videoData.title,
                    description: videoData.description,
                    duration: videoData.duration,
                    view_count: videoData.view_count,
                    extractor: videoData.extractor,
                    is_live: videoData.is_live,
                    thumbnail: videoData.thumbnail
                },
                formats: {
                    video: videoFormats,
                    audio: audioFormats
                },
                download_instructions: {
                    message: 'Use os endpoints /musica ou /clipe com os parâmetros url e opcionalmente format',
                    examples: {
                        musica: `/musica?url=${encodeURIComponent(url)}`,
                        clipe: `/clipe?url=${encodeURIComponent(url)}`,
                        formato_especifico: `/musica?url=${encodeURIComponent(url)}&format=FORMAT_ID`
                    }
                }
            });
        } else {
            // Resposta simples (apenas informações básicas)
            return res.json({
                success: true,
                basic_info: infoData,
                message: 'Informações básicas obtidas. Para formatos de download, a API pode requerer autenticação adicional.'
            });
        }

    } catch (error) {
        console.error('Erro ao verificar vídeo:', error.message);
        
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

// Rota para baixar música/áudio (melhorada)
app.get('/musica', async (req, res) => {
    try {
        const { url, format, quality = 'best', lang = 'pt', country = 'BR' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/musica?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`🎵 Processando download de música: ${url}`);

        let formatId = format;

        // Se format_id não foi fornecido, tentar obter formatos disponíveis
        if (!formatId) {
            const infoResponse = await getVideoInfo(url, lang, country);
            
            if (infoResponse.status !== 200) {
                return res.status(infoResponse.status).json({
                    error: 'Erro ao obter informações do vídeo',
                    message: infoResponse.data
                });
            }

            const infoData = infoResponse.data;
            console.log('📊 Estrutura da resposta da API:', JSON.stringify(infoData, null, 2));

            if (infoData.data && typeof infoData.data === 'object') {
                const videoData = infoData.data;
                const audioFormats = findAudioFormats(videoData);
                
                console.log(`🔍 Formatos de áudio encontrados: ${audioFormats.length}`);

                if (audioFormats.length === 0) {
                    return res.status(404).json({
                        error: 'Nenhum formato de áudio disponível',
                        message: 'Não foi possível encontrar formatos de áudio para este vídeo',
                        debug: {
                            available_keys: Object.keys(videoData),
                            data_structure: videoData
                        },
                        suggestion: 'Tente usar o endpoint /check para ver todos os formatos disponíveis'
                    });
                }

                // Escolher formato baseado na qualidade
                const selectedFormat = selectFormat(audioFormats, quality);
                
                if (!selectedFormat || !selectedFormat.id) {
                    return res.status(404).json({
                        error: 'Formato de áudio inválido',
                        message: 'Não foi possível selecionar um formato válido',
                        available_formats: audioFormats.map(f => ({
                            id: f.id,
                            ext: f.ext,
                            quality: f.quality,
                            abr: f.abr,
                            format_note: f.format_note
                        }))
                    });
                }

                formatId = selectedFormat.id;
                console.log(`🎵 Formato selecionado: ${formatId} (${selectedFormat.ext})`);
            } else {
                return res.status(404).json({
                    error: 'Dados do vídeo não disponíveis',
                    message: 'A API retornou informações limitadas. Tente fornecer um format específico.',
                    raw_response: infoData
                });
            }
        }

        console.log(`🎵 Baixando áudio com formato: ${formatId}`);

        // Fazer download
        const downloadResponse = await downloadMedia(url, formatId, lang, country);

        if (downloadResponse.status !== 200) {
            return res.status(downloadResponse.status).json({
                error: 'Erro no download',
                message: 'Falha ao baixar o áudio',
                format_used: formatId
            });
        }

        // Determinar nome do arquivo
        let filename = `musica_${formatId}`;
        const contentType = downloadResponse.headers['content-type'] || '';
        
        // Determinar extensão pelo content-type
        const ext = contentType.includes('audio/mpeg') ? 'mp3' :
                   contentType.includes('audio/mp4') || contentType.includes('audio/m4a') ? 'm4a' :
                   contentType.includes('audio/webm') ? 'webm' :
                   contentType.includes('audio/ogg') ? 'ogg' : 'm4a';
        
        filename += `.${ext}`;

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
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Rota para baixar clipe/vídeo (melhorada)
app.get('/clipe', async (req, res) => {
    try {
        const { url, format, quality = 'best', lang = 'pt', country = 'BR' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/clipe?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`🎬 Processando download de clipe: ${url}`);

        let formatId = format;

        // Se format_id não foi fornecido, tentar obter formatos disponíveis
        if (!formatId) {
            const infoResponse = await getVideoInfo(url, lang, country);
            
            if (infoResponse.status !== 200) {
                return res.status(infoResponse.status).json({
                    error: 'Erro ao obter informações do vídeo',
                    message: infoResponse.data
                });
            }

            const infoData = infoResponse.data;
            console.log('📊 Estrutura da resposta da API:', JSON.stringify(infoData, null, 2));

            if (infoData.data && typeof infoData.data === 'object') {
                const videoData = infoData.data;
                const videoFormats = findVideoFormats(videoData);
                
                console.log(`🔍 Formatos de vídeo encontrados: ${videoFormats.length}`);

                if (videoFormats.length === 0) {
                    return res.status(404).json({
                        error: 'Nenhum formato de vídeo disponível',
                        message: 'Não foi possível encontrar formatos de vídeo para este clipe',
                        debug: {
                            available_keys: Object.keys(videoData),
                            data_structure: videoData
                        },
                        suggestion: 'Tente usar o endpoint /check para ver todos os formatos disponíveis'
                    });
                }

                // Escolher formato baseado na qualidade
                const selectedFormat = selectFormat(videoFormats, quality);
                
                if (!selectedFormat || !selectedFormat.id) {
                    return res.status(404).json({
                        error: 'Formato de vídeo inválido',
                        message: 'Não foi possível selecionar um formato válido',
                        available_formats: videoFormats.map(f => ({
                            id: f.id,
                            ext: f.ext,
                            quality: f.quality,
                            height: f.height,
                            width: f.width,
                            format_note: f.format_note
                        }))
                    });
                }

                formatId = selectedFormat.id;
                console.log(`🎬 Formato selecionado: ${formatId} (${selectedFormat.ext})`);
            } else {
                return res.status(404).json({
                    error: 'Dados do vídeo não disponíveis',
                    message: 'A API retornou informações limitadas. Tente fornecer um format específico.',
                    raw_response: infoData
                });
            }
        }

        console.log(`🎬 Baixando vídeo com formato: ${formatId}`);

        // Fazer download
        const downloadResponse = await downloadMedia(url, formatId, lang, country);

        if (downloadResponse.status !== 200) {
            return res.status(downloadResponse.status).json({
                error: 'Erro no download',
                message: 'Falha ao baixar o vídeo',
                format_used: formatId
            });
        }

        // Determinar nome do arquivo
        let filename = `clipe_${formatId}`;
        const contentType = downloadResponse.headers['content-type'] || '';
        
        // Determinar extensão pelo content-type
        const ext = contentType.includes('video/mp4') ? 'mp4' :
                   contentType.includes('video/webm') ? 'webm' :
                   contentType.includes('video/avi') ? 'avi' :
                   contentType.includes('video/mkv') ? 'mkv' : 'mp4';
        
        filename += `.${ext}`;

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
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Rota para obter apenas os formatos disponíveis
app.get('/formatos', async (req, res) => {
    try {
        const { url, lang = 'pt', country = 'BR' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL do vídeo é obrigatória',
                message: 'Forneça o parâmetro "url" na query string',
                exemplo: '/formatos?url=https://www.youtube.com/watch?v=VIDEO_ID'
            });
        }

        console.log(`📋 Obtendo formatos para: ${url}`);

        const infoResponse = await getVideoInfo(url, lang, country);
        
        if (infoResponse.status !== 200) {
            return res.status(infoResponse.status).json({
                error: 'Erro ao obter informações do vídeo',
                message: infoResponse.data
            });
        }

        const infoData = infoResponse.data;

        if (infoData.data && typeof infoData.data === 'object') {
            const videoData = infoData.data;
            const audioFormats = findAudioFormats(videoData);
            const videoFormats = findVideoFormats(videoData);

            return res.json({
                success: true,
                url: url,
                formats: {
                    video: videoFormats.map(f => ({
                        id: f.id,
                        ext: f.ext,
                        quality: f.quality,
                        height: f.height,
                        width: f.width,
                        format_note: f.format_note,
                        filesize: f.filesize
                    })),
                    audio: audioFormats.map(f => ({
                        id: f.id,
                        ext: f.ext,
                        quality: f.quality,
                        abr: f.abr,
                        asr: f.asr,
                        format_note: f.format_note,
                        filesize: f.filesize
                    }))
                },
                counts: {
                    video_formats: videoFormats.length,
                    audio_formats: audioFormats.length
                }
            });
        } else {
            return res.json({
                success: false,
                message: 'Formatos não disponíveis na resposta da API',
                raw_response: infoData
            });
        }

    } catch (error) {
        console.error('Erro ao obter formatos:', error.message);
        
        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
});

// Rota de informações da API
app.get('/info', (req, res) => {
    res.json({
        name: 'Any4K Express API - Versão Final',
        version: '2.0.0',
        description: 'API Express final para download de músicas e clipes usando any4k.com - Incorpora melhorias do wrapper Flask',
        improvements: [
            'Payload correto baseado no wrapper Flask funcional',
            'Busca melhorada por formatos usando estruturas corretas',
            'Endpoint /check para verificar informações e formatos',
            'Endpoint /formatos para listar apenas formatos',
            'Seleção automática de formato quando não especificado',
            'Logs detalhados para debug',
            'Tratamento de erros robusto'
        ],
        endpoints: {
            '/check': {
                method: 'GET',
                description: 'Verificar informações e formatos de um vídeo',
                parameters: {
                    url: 'URL do vídeo (obrigatório)',
                    lang: 'Código do idioma (opcional, padrão: pt)',
                    country: 'Código do país (opcional, padrão: BR)'
                },
                exemplo: '/check?url=https://www.youtube.com/watch?v=VIDEO_ID'
            },
            '/musica': {
                method: 'GET',
                description: 'Baixar áudio/música de um vídeo',
                parameters: {
                    url: 'URL do vídeo (obrigatório)',
                    format: 'ID do formato específico (opcional)',
                    quality: 'best, worst ou qualidade específica (opcional, padrão: best)'
                },
                exemplo: '/musica?url=https://www.youtube.com/watch?v=VIDEO_ID'
            },
            '/clipe': {
                method: 'GET',
                description: 'Baixar vídeo/clipe',
                parameters: {
                    url: 'URL do vídeo (obrigatório)',
                    format: 'ID do formato específico (opcional)',
                    quality: 'best, worst, 720p, 1080p, etc. (opcional, padrão: best)'
                },
                exemplo: '/clipe?url=https://www.youtube.com/watch?v=VIDEO_ID'
            },
            '/formatos': {
                method: 'GET',
                description: 'Obter apenas os formatos disponíveis',
                parameters: {
                    url: 'URL do vídeo (obrigatório)'
                },
                exemplo: '/formatos?url=https://www.youtube.com/watch?v=VIDEO_ID'
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
        message: 'Any4K Express API - Versão Final - Servidor funcionando!',
        version: '2.0.0',
        status: 'Incorpora melhorias do wrapper Flask funcional',
        endpoints: [
            'GET /check?url=VIDEO_URL - Verificar informações e formatos',
            'GET /musica?url=VIDEO_URL - Baixar música/áudio',
            'GET /clipe?url=VIDEO_URL - Baixar vídeo/clipe',
            'GET /formatos?url=VIDEO_URL - Listar formatos disponíveis',
            'GET /info - Informações da API'
        ],
        exemplo_uso: {
            check: `${req.protocol}://${req.get('host')}/check?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
            musica: `${req.protocol}://${req.get('host')}/musica?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
            clipe: `${req.protocol}://${req.get('host')}/clipe?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
            formatos: `${req.protocol}://${req.get('host')}/formatos?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`
        },
        key_improvements: [
            '✅ Payload correto baseado no wrapper Flask',
            '✅ Busca por formatos usando estruturas corretas',
            '✅ Endpoint /check para análise completa',
            '✅ Seleção automática de formato',
            '✅ Tratamento robusto de erros'
        ]
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Any4K Express (Versão Final) rodando na porta ${PORT}`);
    console.log(`📱 Endpoints disponíveis:`);
    console.log(`   GET /check?url=VIDEO_URL - Verificar informações e formatos`);
    console.log(`   GET /musica?url=VIDEO_URL - Baixar música/áudio`);
    console.log(`   GET /clipe?url=VIDEO_URL - Baixar vídeo/clipe`);
    console.log(`   GET /formatos?url=VIDEO_URL - Listar formatos disponíveis`);
    console.log(`   GET /info - Informações da API`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`🔧 Melhorias implementadas:`);
    console.log(`   ✅ Payload correto baseado no wrapper Flask funcional`);
    console.log(`   ✅ Busca por formatos usando estruturas corretas da API`);
    console.log(`   ✅ Endpoint /check para análise completa de vídeos`);
    console.log(`   ✅ Seleção automática de formato quando não especificado`);
    console.log(`   ✅ Tratamento robusto de erros e logs detalhados`);
});

module.exports = app;

