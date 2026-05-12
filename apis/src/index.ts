import { serve } from '@hono/node-server'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { bearerAuth } from 'hono/bearer-auth'
import * as dotenv from 'dotenv'

dotenv.config()

const app = new OpenAPIHono()

// Define a security scheme for Swagger UI
app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'Enter your API key here (the value of API_SECRET_KEY from your .env)'
})

// Apply bearerAuth middleware to all /api/* routes
app.use('/api/*', (c, next) => {
  const token = process.env.RAILRADAR_API_KEY
  if (!token) {
    return c.json({ error: 'API Key not configured in environment' }, 500)
  }
  const auth = bearerAuth({ token })
  return auth(c, next)
})


// Wrapper for RailRadar search stations API
const searchStationsRoute = createRoute({
  method: 'get',
  path: '/api/v1/search/stations',
  tags: ['Stations'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      query: z.string().min(1).openapi({
        param: { name: 'query', in: 'query' },
        example: 'NDLS'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Station search results'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(searchStationsRoute, async (c) => {
  const { query } = c.req.valid('query')
  
  try {
    const response = await fetch(`https://api.railradar.org/api/v1/search/stations?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar search trains API
const searchTrainsRoute = createRoute({
  method: 'get',
  path: '/api/v1/search/trains',
  tags: ['Trains'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      query: z.string().min(1).openapi({
        param: { name: 'query', in: 'query' },
        example: '12004'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Train search results'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(searchTrainsRoute, async (c) => {
  const { query } = c.req.valid('query')
  
  try {
    const response = await fetch(`https://api.railradar.org/api/v1/search/trains?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar live-map API
const liveMapRoute = createRoute({
  method: 'get',
  path: '/api/v1/trains/live-map',
  tags: ['Trains'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Live train map data'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(liveMapRoute, async (c) => {
  try {
    const response = await fetch(`https://api.railradar.org/api/v1/trains/live-map`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar train schedule API
const trainScheduleRoute = createRoute({
  method: 'get',
  path: '/api/v1/trains/{trainNumber}/schedule',
  tags: ['Trains'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      trainNumber: z.string().min(5).max(5).openapi({
        param: { name: 'trainNumber', in: 'path' },
        example: '12004'
      })
    }),
    query: z.object({
      journeyDate: z.string().openapi({
        param: { name: 'journeyDate', in: 'query' },
        example: '2023-12-01'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Train schedule results'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Not found'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(trainScheduleRoute, async (c) => {
  const { trainNumber } = c.req.valid('param')
  const { journeyDate } = c.req.valid('query')
  
  try {
    const url = `https://api.railradar.org/api/v1/trains/${encodeURIComponent(trainNumber)}/schedule?journeyDate=${encodeURIComponent(journeyDate)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar train list API
const trainListRoute = createRoute({
  method: 'get',
  path: '/api/v1/trains/list',
  tags: ['Trains'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional().openapi({
        param: { name: 'page', in: 'query' },
        example: '1'
      }),
      limit: z.string().optional().openapi({
        param: { name: 'limit', in: 'query' },
        example: '50'
      }),
      type: z.string().optional().openapi({
        param: { name: 'type', in: 'query' },
        example: 'EXPRESS'
      }),
      zone: z.string().optional().openapi({
        param: { name: 'zone', in: 'query' },
        example: 'NR'
      }),
      search: z.string().optional().openapi({
        param: { name: 'search', in: 'query' },
        example: 'Rajdhani'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Paginated train list'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(trainListRoute, async (c) => {
  const query = c.req.query()
  const searchParams = new URLSearchParams(query as Record<string, string>)
  const queryString = searchParams.toString()

  try {
    const url = `https://api.railradar.org/api/v1/trains/list${queryString ? '?' + queryString : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar live station board API
const liveStationBoardRoute = createRoute({
  method: 'get',
  path: '/api/v1/stations/{stationCode}/live',
  tags: ['Stations'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      stationCode: z.string().min(1).max(10).openapi({
        param: { name: 'stationCode', in: 'path' },
        example: 'NDLS'
      })
    }),
    query: z.object({
      hours: z.string().optional().openapi({
        param: { name: 'hours', in: 'query' },
        example: '4'
      }),
      toStationCode: z.string().optional().openapi({
        param: { name: 'toStationCode', in: 'query' },
        example: 'BCT'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Live station board results'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    404: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Not found'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(liveStationBoardRoute, async (c) => {
  const { stationCode } = c.req.valid('param')
  const query = c.req.query()
  const searchParams = new URLSearchParams()
  if (query.hours) searchParams.append('hours', query.hours)
  if (query.toStationCode) searchParams.append('toStationCode', query.toStationCode)
  const queryString = searchParams.toString()

  try {
    const url = `https://api.railradar.org/api/v1/stations/${encodeURIComponent(stationCode)}/live${queryString ? '?' + queryString : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Wrapper for RailRadar trains between API
const trainsBetweenRoute = createRoute({
  method: 'get',
  path: '/api/v1/trains/between',
  tags: ['Trains'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      from: z.string().min(1).openapi({
        param: { name: 'from', in: 'query' },
        example: 'NDLS'
      }),
      to: z.string().min(1).openapi({
        param: { name: 'to', in: 'query' },
        example: 'BCT'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Trains between stations results'
    },
    400: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Bad request'
    },
    500: {
      content: {
        'application/json': { schema: z.any() }
      },
      description: 'Internal Server Error'
    }
  }
})

app.openapi(trainsBetweenRoute, async (c) => {
  const { from, to } = c.req.valid('query')
  
  try {
    const url = `https://api.railradar.org/api/v1/trains/between?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.RAILRADAR_API_KEY || '',
        'Authorization': `Bearer ${process.env.RAILRADAR_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return c.json(
        { success: false, error: { message: `RailRadar API responded with ${response.status}` } },
        response.status as any
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error fetching from RailRadar:', error)
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500)
  }
})

// Register OpenAPI Schema
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Journey Agent API',
  },
})

// Serve Swagger UI
app.get('/ui', swaggerUI({ url: '/doc' }))

serve({
  fetch: app.fetch,
  port: 9000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port} 
Swagger UI is available at http://localhost:${info.port}/ui`)
})
