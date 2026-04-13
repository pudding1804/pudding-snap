export const STYLE_TYPES = [
  { id: 'minimalist', name: '极简', nameEn: 'Minimalist' },
  { id: 'cyberpunk', name: '赛博', nameEn: 'Cyberpunk' },
  { id: 'polaroid', name: '拍立得', nameEn: 'Polaroid' },
  { id: 'vaporwave', name: '蒸汽波', nameEn: 'Vaporwave' },
  { id: 'editorial', name: '杂志', nameEn: 'Editorial' },
  { id: 'pink', name: '少女粉', nameEn: 'Pink' },
  { id: 'gothic', name: '哥特', nameEn: 'Gothic' }
]

export const SHARE_CARD_STYLES = {
  minimalist: {
    container: {
      background: '#ffffff',
      padding: 24,
      fontFamily: '"Segoe UI", Arial, sans-serif'
    },
    imageContainer: {
      borderRadius: 8,
      background: '#f5f5f5',
      marginBottom: 20
    },
    image: {},
    textSection: {
      textAlign: 'center'
    },
    title: {
      fontSize: 28,
      fontWeight: 300,
      color: '#1a1a1a',
      marginBottom: 8,
      letterSpacing: '-0.5px'
    },
    dateTime: {
      fontSize: 14,
      color: '#888',
      marginBottom: 12
    },
    note: {
      fontSize: 15,
      color: '#555',
      lineHeight: 1.6,
      fontStyle: 'italic',
      marginBottom: 12
    },
    username: {
      fontSize: 12,
      color: '#999'
    },
    watermark: {
      bottom: 10,
      right: 14,
      fontSize: 10,
      color: 'rgba(0,0,0,0.2)',
      fontWeight: 500,
      letterSpacing: '0.3px'
    }
  },

  cyberpunk: {
    container: {
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 100%)',
      padding: 20,
      fontFamily: 'Consolas, "Courier New", monospace',
      border: '2px solid #ff00ff',
      boxShadow: '0 0 30px rgba(255,0,255,0.3)'
    },
    imageContainer: {
      border: '1px solid #00ffff',
      boxShadow: '0 0 20px rgba(0,255,255,0.4)',
      background: '#000',
      marginBottom: 16
    },
    image: {
      filter: 'contrast(1.1) saturate(1.2)'
    },
    textSection: {
      textAlign: 'center'
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#00ffff',
      marginBottom: 6,
      textShadow: '0 0 10px rgba(0,255,255,0.8)',
      textTransform: 'uppercase',
      letterSpacing: '2px'
    },
    dateTime: {
      fontSize: 13,
      color: '#ff00ff',
      marginBottom: 10,
      textShadow: '0 0 5px rgba(255,0,255,0.5)'
    },
    note: {
      fontSize: 14,
      color: '#ddd',
      lineHeight: 1.5,
      marginBottom: 10
    },
    username: {
      fontSize: 12,
      color: '#ff00ff',
      letterSpacing: '1px'
    },
    watermark: {
      bottom: 8,
      right: 12,
      fontSize: 9,
      color: 'rgba(0,255,255,0.25)',
      letterSpacing: '1px',
      textTransform: 'uppercase'
    },
    decorations: [
      {
        type: 'topLine',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, #ff00ff, #00ffff, transparent)'
        }
      }
    ]
  },

  polaroid: {
    container: {
      background: '#f5f5f0',
      padding: 20,
      fontFamily: 'Georgia, "Times New Roman", serif',
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
    },
    imageContainer: {
      background: '#fff',
      padding: 16,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      marginBottom: 16
    },
    image: {},
    textSection: {
      textAlign: 'center'
    },
    title: {
      fontSize: 22,
      fontWeight: 500,
      color: '#333',
      marginBottom: 6
    },
    dateTime: {
      fontSize: 14,
      color: '#666',
      marginBottom: 10,
      letterSpacing: '0.5px'
    },
    note: {
      fontSize: 15,
      color: '#555',
      lineHeight: 1.5,
      fontStyle: 'italic',
      marginBottom: 10
    },
    username: {
      fontSize: 12,
      color: '#777'
    },
    watermark: {
      bottom: 8,
      right: 12,
      fontSize: 9,
      color: 'rgba(0,0,0,0.18)',
      fontWeight: 500
    }
  },

  vaporwave: {
    container: {
      background: 'linear-gradient(180deg, #ff71ce 0%, #01cdfe 50%, #05ffa1 100%)',
      padding: 20,
      fontFamily: '"Courier New", monospace'
    },
    imageContainer: {
      background: 'rgba(0,0,0,0.85)',
      borderRadius: 8,
      marginBottom: 16,
      innerWrapper: {
        margin: 12,
        borderRadius: 4,
        border: '3px solid #ff71ce',
        boxShadow: '0 0 25px rgba(255,113,206,0.5)'
      }
    },
    image: {},
    textSection: {
      background: 'rgba(0,0,0,0.75)',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center'
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 6,
      textShadow: '2px 2px 0 #ff71ce',
      textTransform: 'uppercase',
      letterSpacing: '2px'
    },
    dateTime: {
      fontSize: 13,
      color: '#05ffa1',
      marginBottom: 10,
      fontWeight: 'bold'
    },
    note: {
      fontSize: 14,
      color: '#fff',
      lineHeight: 1.5,
      marginBottom: 10
    },
    username: {
      fontSize: 12,
      color: '#01cdfe'
    },
    watermark: {
      bottom: 10,
      right: 14,
      fontSize: 10,
      color: 'rgba(255,255,255,0.3)',
      fontWeight: 500,
      letterSpacing: '0.5px'
    }
  },

  editorial: {
    container: {
      background: '#1a1a1a',
      fontFamily: 'Georgia, "Times New Roman", serif'
    },
    imageContainer: {
      background: '#111',
      marginBottom: 0
    },
    image: {},
    textSection: {
      background: 'linear-gradient(180deg, rgba(30,30,30,0.95), rgba(10,10,10,0.98))',
      padding: 24,
      textAlign: 'center'
    },
    title: {
      fontSize: 24,
      fontWeight: 600,
      color: '#fff',
      marginBottom: 8
    },
    dateTime: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: '1px'
    },
    note: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.7)',
      lineHeight: 1.6,
      fontStyle: 'italic',
      marginBottom: 12
    },
    username: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.4)'
    },
    watermark: {
      bottom: 8,
      right: 12,
      fontSize: 9,
      color: 'rgba(255,255,255,0.18)',
      letterSpacing: '0.3px'
    }
  },

  pink: {
    container: {
      background: 'linear-gradient(180deg, #ffc8dd 0%, #ffafcc 50%, #bde0fe 100%)',
      padding: 24,
      fontFamily: '"Comic Sans MS", Tahoma, sans-serif'
    },
    imageContainer: {
      borderRadius: 12,
      background: '#fff',
      marginBottom: 20,
      boxShadow: '0 8px 25px rgba(255,175,204,0.3)'
    },
    image: {},
    textSection: {
      background: 'rgba(255,255,255,0.8)',
      borderRadius: 12,
      padding: 20,
      textAlign: 'center',
      boxShadow: '0 4px 15px rgba(255,175,204,0.2)'
    },
    title: {
      fontSize: 24,
      fontWeight: 600,
      color: '#e63946',
      marginBottom: 8,
      textShadow: '1px 1px 0 rgba(255,175,204,0.5)'
    },
    dateTime: {
      fontSize: 14,
      color: '#8d99ae',
      marginBottom: 12
    },
    note: {
      fontSize: 15,
      color: '#457b9d',
      lineHeight: 1.6,
      fontStyle: 'italic',
      marginBottom: 12
    },
    username: {
      fontSize: 13,
      color: '#e63946',
      fontWeight: 500
    },
    watermark: {
      bottom: 10,
      right: 14,
      fontSize: 10,
      color: 'rgba(0,0,0,0.3)',
      fontWeight: 500,
      letterSpacing: '0.3px'
    }
  },

  gothic: {
    container: {
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 30%, #2a1010 70%, #1a0a0a 100%)',
      padding: 24,
      fontFamily: '"Times New Roman", Georgia, serif',
      border: '2px solid #6a040f',
      boxShadow: '0 0 40px rgba(106, 4, 15, 0.3)'
    },
    imageContainer: {
      background: 'rgba(0,0,0,0.9)',
      borderRadius: 4,
      marginBottom: 20,
      border: '2px solid #c1121f',
      boxShadow: 'inset 0 0 30px rgba(193, 18, 31, 0.3)'
    },
    image: {
      filter: 'contrast(1.2) brightness(0.8) saturate(1.1) sepia(0.2)'
    },
    textSection: {
      background: 'rgba(0,0,0,0.85)',
      borderRadius: 4,
      padding: 20,
      textAlign: 'center',
      border: '1px solid #c1121f',
      boxShadow: '0 4px 15px rgba(193, 18, 31, 0.2)'
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#f8edeb',
      marginBottom: 8,
      textShadow: '0 0 15px rgba(193, 18, 31, 0.5)',
      fontStyle: 'italic',
      letterSpacing: '1px'
    },
    dateTime: {
      fontSize: 14,
      color: '#e63946',
      marginBottom: 12,
      letterSpacing: '1.5px',
      textShadow: '0 0 5px rgba(230, 57, 70, 0.3)'
    },
    note: {
      fontSize: 15,
      color: '#d1d5db',
      lineHeight: 1.6,
      fontStyle: 'italic',
      marginBottom: 12,
      textShadow: '0 0 5px rgba(209, 213, 219, 0.2)'
    },
    username: {
      fontSize: 13,
      color: '#f8edeb',
      fontStyle: 'italic',
      textShadow: '0 0 10px rgba(193, 18, 31, 0.3)'
    },
    watermark: {
      bottom: 10,
      right: 14,
      fontSize: 10,
      color: 'rgba(230, 57, 70, 0.3)',
      letterSpacing: '0.8px',
      fontStyle: 'italic'
    },
    decorations: [
      {
        type: 'spire',
        style: {
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '20px solid transparent',
          borderRight: '20px solid transparent',
          borderBottom: '20px solid #6a040f'
        }
      },
      {
        type: 'topLine',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #c1121f, transparent)'
        }
      },
      {
        type: 'bottomLine',
        style: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #c1121f, transparent)'
        }
      }
    ]
  }
}

export const LAYOUT_OPTIONS = [
  { id: 'landscape16x9', name: '横屏 16:9', ratio: 16 / 9 },
  { id: 'square', name: '正方形', ratio: 1 },
  { id: 'landscape4x3', name: '横屏 4:3', ratio: 4 / 3 },
  { id: 'portrait4x3', name: '竖屏 4:3', ratio: 3 / 4 }
]

export const EXPORT_FORMATS = [
  { id: 'jpg', name: 'JPG' },
  { id: 'png', name: 'PNG' }
]

export const MAX_CARD_WIDTH = 720
export const MIN_CARD_WIDTH = 480
export const MIN_CARD_HEIGHT = 400
export const MAX_CARD_HEIGHT = 720
export const TEXT_AREA_HEIGHT = 140
export const PREVIEW_MAX_HEIGHT = 500
export const MIN_IMAGE_HEIGHT = 180
