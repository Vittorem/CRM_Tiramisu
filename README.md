# King Candy: CRM Tiramisú

Sistema integral de gestión de clientes, pedidos, inventario y reportes para **King Candy La Casa Del Tiramisú**.## 🚀 Funcionalidades de Negocio

### 🛒 Gestión de Pedidos (Kanban)
- Flujo de trabajo visual mediante un tablero Kanban para el seguimiento de pedidos desde la recepción hasta la entrega.
- Clasificación por estados: Pendiente, Producción, Listos, Entregados y Cancelados.
- Filtros rápidos por fecha y canal de venta.

### 👥 CRM & Demografía
- Base de datos centralizada de clientes con historial de compras.
- Análisis demográfico automático para identificar zonas de mayor venta.
- Sistema de detección de clientes inactivos para campañas de reactivación.

### 🥗 Recetario & Costeo Estricto
- Gestión detallada de insumos e ingredientes con precios actualizados.
- **Costeo de Recetas:** Cálculo automático del costo estimado por porción y margen de utilidad.
- **Vínculo Estricto:** Conexión relacional entre recetas, productos y sabores para garantizar la precisión en los reportes de costos.

### 📊 Reportes e Inteligencia
- Dashboard con KPIs en tiempo real (Ingresos, Pedidos, Tickets Promedio).
- Exportación de reportes detallados en formatos Excel, PDF y XML.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript (strict) |
| **UI Kit** | Ant Design 5 (Personalizado) |
| **Build Tool** | Vite 5 + SWC |
| **Estado & Cache** | React Query (TanStack Query) |
| **Backend** | Firebase (Auth, Firestore, Hosting) |
| **Gráficos** | Recharts |
| **PWA** | Soporte Offline y modo App móvil |

---

## 📂 Estructura del Proyecto

```
src/
├── components/        # Componentes compartidos y Layout
├── features/
│   ├── auth/          # Gestión de autenticación
│   ├── customers/     # CRM y Demografía
│   ├── dashboard/     # Métricas y KPIs
│   ├── inventory/     # Stock y movimientos de almacén
│   ├── orders/        # Tablero Kanban y formularios de pedidos
│   ├── recetario/     # Insumos, recetas y cálculos de costos
│   ├── reports/       # Lógica de exportación de datos
│   └── settings/      # Configuración de catálogos y sistema
├── hooks/             # Custom hooks (useFirestore, useIsMobile)
├── services/          # Servicios externos (Exportación, Firebase)
└── utils/             # Lógica de negocio (Helpers, Análisis de Comportamiento RFM)
```

## ⚙️ Configuración

1. **Clonar repositorio**
2. **Variables de Entorno:** Copia `.env.example` a `.env` y configura tus credenciales de Firebase.
3. **Instalación:**
   ```bash
   npm install
   ```

## 📜 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el entorno de desarrollo local. |
| `npm run build` | Genera el build optimizado para producción. |
| `npm run preview` | Previsualiza el build de producción localmente. |
| `firebase deploy` | Despliega la aplicación a Firebase Hosting. |

## 🛡️ Decisiones de Arquitectura

- **PWA First**: Diseñado para ser instalado en dispositivos móviles para uso rápido en punto de venta.
- **Firestore-level filtering**: Filtrado de registros borrados (`isDeleted`) a nivel de servidor para optimizar ancho de banda.
- **Separación por Features**: Arquitectura modular que permite escalar funcionalidades de forma independiente.
- **TypeScript Strict**: Tipado fuerte en todo el sistema para minimizar errores en producción.

## 📄 Licencia

Privado — Uso exclusivo para King Candy La Casa Del Tiramisú.
