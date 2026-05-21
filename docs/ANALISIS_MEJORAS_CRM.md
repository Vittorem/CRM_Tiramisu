# Análisis Profundo: Tiramisu como CRM

Tras revisar la arquitectura, los módulos y los modelos de datos del proyecto (`src/types/index.ts`, estructura de carpetas, etc.), se observa que **Tiramisu es actualmente un híbrido excelente entre un Gestor de Pedidos (OMS), un mini-ERP (Inventario/Recetas) y un CRM operativo básico (Gestión de Contactos)**. 

Sin embargo, evaluándolo estrictamente bajo el estándar de un **CRM (Customer Relationship Management) maduro**, aquí te detallo lo que considero que le **falta** para llevarlo al siguiente nivel:

## 1. Gestión de Leads y Embudo de Pre-Venta (Sales Pipeline)
Actualmente, el Kanban `ORDER_STATUSES` ("Pendiente" -> "Entregado") gestiona el **cumplimiento** del pedido, pero *no la venta en sí*.
- **Le falta:** Un embudo para adquirir el cliente. Faltan estados como: `Prospecto`, `Contactado`, `Negociando`, `Cotización Enviada`, `Cerrado Ganado/Perdido`. 
- **Por qué importa:** Específicamente para clientes `B2B`, las ventas toman tiempo y seguimiento. Necesitas saber cuántos "Leads" o prospectos tienes en proceso antes de que se conviertan en una Orden confirmada.

## 2. Historial de Interacciones y Actividades (Activity Log)
Actualmente, el perfil de `Customer` solo tiene un campo de texto `notes`. 
- **Le falta:** Un registro de actividad (Timeline) por cliente. Ejemplo: "Se le llamó el lunes", "Se le envió PDF por WhatsApp", "Se quejó de un retraso". 
- **Por qué importa:** Si otro miembro del equipo atiende al cliente, no tiene contexto de lo que se habló anteriormente con él.

## 3. Sistema de Tareas y Recordatorios (Task Management)
- **Le falta:** La capacidad de asignarle una tarea a un usuario del sistema (ej. "Recordarle a [Cliente] hacer su pedido mensual de B2B el día 15").
- **Por qué importa:** Un buen CRM te avisa a quién tienes que contactar hoy para no perder ventas.

## 4. Automatización de Marketing y Campañas (Marketing Automation)
Ya tienes un gran motor con los `tags`, el tipo `B2C/B2B` y el cálculo de `lastDeliveredAt` y `ordersCount`.
- **Le falta:** Un módulo para crear campañas enviadas masivamente. Por ejemplo: Filtrar todos los clientes que no han comprado en 30 días y generar una lista para mandarles una promoción por WhatsApp.
- **Por qué importa:** Los datos de tus clientes están ahí, pero tienes que extraerlos manualmente. Un CRM debería dejarte impactar "segmentos" de clientes con un clic. 
*(Nota: Vi que ya tienes un plan de Automatización de WhatsApp en progreso, lo cual ataca directamente este punto).*

## 5. Módulo de Atención al Cliente (Ticketing / Casos)
Actualmente todo gira en torno a la `Order` feliz ("Entregado").
- **Le falta:** Un lugar para registrar devoluciones, quejas, compensaciones de "mal servicio" o preguntas.
- **Por qué importa:** Si un cliente tuvo una mala experiencia, el CRM debería indicarlo con una alerta roja para darle un trato especial en su próxima compra.

## 6. Cotizaciones (Quotes)
- **Le falta:** Capacidad de generar y enviar un PDF/Link de "Cotización" (especial para eventos o clientes B2B grandes) que luego pueda convertirse en una `Order` con un clic.
- **Por qué importa:** En ventas corporativas, no puedes crear una orden "Pendiente" directamente si el cliente aún está evaluando precios.

---

### Conclusión y Recomendación de Siguiente Paso
El sistema es muy robusto para el nicho actual (comida/repostería con inventario y entregas). 

Si tuviera que priorizar qué agregar primero para potenciar las **VENTAS**, sugeriría:
1. **Historial y Recordatorios de Contacto**: Permitir agregar fechas de "Próximo contacto" y un log rápido de conversaciones.
2. **Automatización WhatsApp**: Finalizar la integración prometida para enviar el menú, avisos de envío y encuestas sin esfuerzo humano.
