# Whispr - Aplicación de Chat Seguro

### Proyecto 2 - Cifrado de Información CC3078
#### Universidad del Valle de Guatemala
Project Developers
- Adrian Rodriguez 21691
- Daniel Gomez 21429
- Esteban Donis 21610
- Abner Ivan Garcia 21285

Aplicación de mensajería segura que implementa cifrado de extremo a extremo utilizando el protocolo de intercambio de claves X3DH (Extended Triple Diffie-Hellman) y estándares criptográficos modernos.

## 🚀 Configuración

### Prerrequisitos

- Node.js (versión 18 o superior)
- npm (incluido con Node.js)
- Un navegador web que soporte WebCrypto API

### Instalación

1. **Clonar el repositorio** (si no se ha hecho ya):
   ```bash
   git clone https://github.com/estebandonis/whispr_front-Cyphers.git
   cd whispr_front-Cyphers
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configuración del entorno**:
   Crear un archivo `.env` en el directorio raíz y configurar la URL del servidor:
   ```bash
   VITE_SERVER_URL=http://localhost:3000
   ```

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

## 🛠 Stack Tecnológico

### Framework Principal
- **React 19.0.0** - React moderno con características concurrentes
- **TypeScript** - Seguridad de tipos y mejor experiencia de desarrollo
- **Vite** - Herramienta de construcción rápida y servidor de desarrollo

### Librerías Criptográficas
- **jose** (v5.9.6) - Cifrado Web JSON, Firmas y Gestión de Claves
- **@panva/hkdf** (v1.2.1) - Implementación de HKDF (Función de Derivación de Claves basada en HMAC)
- **Web Crypto API** - API nativa del navegador para operaciones criptográficas

### Librerías de UI
- **Radix UI** - Componentes de UI accesibles y sin estilos
  - `@radix-ui/react-avatar`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-slot`
- **Tailwind CSS** (v3.4.17) - Framework CSS utility-first
- **class-variance-authority** (v0.7.1) - Variantes de componentes con seguridad de tipos
- **clsx** (v2.1.1) - Utilidad para nombres de clase condicionales
- **tailwind-merge** (v2.5.4) - Fusión eficiente de clases de Tailwind

### Gestión de Estado y HTTP
- **@tanstack/react-query** (v5.62.7) - Gestión de estado del servidor
- **axios** (v1.7.9) - Cliente HTTP para peticiones de API

### Enrutamiento y Navegación
- **react-router-dom** (v7.0.2) - Enrutamiento declarativo para React

### Iconos y Recursos
- **lucide-react** (v0.468.0) - Librería de iconos hermosa y consistente

## 🔒 Implementación Criptográfica

Esta aplicación implementa un sistema de mensajería segura integral utilizando protocolos criptográficos modernos:

### Intercambio de Claves X3DH (Extended Triple Diffie-Hellman)

La aplicación utiliza el **protocolo X3DH** para establecer sesiones seguras entre usuarios:

- **Claves de Identidad (IK)**: Claves ECDSA P-256 de largo plazo para identidad de usuario
- **Claves Pre-firmadas (SPK)**: Claves ECDH P-256 de mediano plazo, firmadas por claves de identidad
- **Claves Pre-generadas de Un Solo Uso (OPK)**: Claves ECDH P-256 de corto plazo para forward secrecy
- **Claves Efímeras**: Claves temporales generadas para cada iniciación de conversación

### Características de Seguridad de Mensajes

#### 1. **Cifrado de Extremo a Extremo**
- **Algoritmo**: AES-256-GCM
- **Derivación de Claves**: HKDF (Función de Derivación de Claves basada en HMAC)
- **Forward Secrecy**: Cada conversación utiliza claves derivadas únicas

#### 2. **Firmas Digitales**
- **Algoritmo**: ECDSA con curva P-256 y hash SHA-256
- **Propósito**: Autenticación de mensajes y no repudio
- **Verificación**: Todos los mensajes son firmados y verificados

#### 3. **Gestión de Claves**
- **Almacenamiento Local**: Claves de conversación almacenadas de forma segura en localStorage del navegador
- **Rotación de Claves**: Soporte para consumo de claves pre-generadas de un solo uso
- **Gestión de Sesiones**: Derivación y almacenamiento automático de claves

#### 4. **Propiedades de Seguridad del Protocolo**
- **Forward Secrecy**: Las claves comprometidas de largo plazo no afectan conversaciones pasadas
- **Seguridad Post-Compromiso**: Las conversaciones futuras permanecen seguras después del compromiso de claves
- **Autenticación de Mensajes**: Todos los mensajes están firmados criptográficamente
- **Protección contra Replay**: Marcas de tiempo e IDs únicos de mensaje previenen ataques de repetición

### Algoritmos Criptográficos Utilizados

| Componente | Algoritmo | Propósito |
|-----------|-----------|-----------|
| Claves de Identidad | ECDSA P-256 | Autenticación de usuario y firmado de claves |
| Intercambio de Claves | ECDH P-256 (X3DH) | Acuerdo seguro de claves |
| Cifrado de Mensajes | AES-256-GCM | Confidencialidad e integridad |
| Derivación de Claves | HKDF-SHA256 | Derivar claves de sesión desde secretos compartidos |
| Firmas Digitales | ECDSA P-256 + SHA-256 | Autenticación de mensajes |
| Generación Aleatoria | Web Crypto API | Generación segura de números aleatorios |

## 🔐 Características de Seguridad

### Seguridad del Cliente
- **Arquitectura de Conocimiento Cero**: El servidor nunca ve mensajes en texto plano
- **Almacenamiento Local de Claves**: Las claves privadas nunca salen del cliente
- **Generación Aleatoria Segura**: Utiliza Web Crypto API para aleatoriedad criptográfica
- **Protección de Memoria**: Las claves se almacenan como objetos CryptoKey cuando es posible

### Comunicación en Tiempo Real
- **Integración WebSocket**: Entrega segura de mensajes en tiempo real
- **Seguridad de Conexión**: Conexiones WebSocket protegidas por cifrado de capa de aplicación
- **Reconexión Automática**: Manejo robusto de conexiones con lógica de reintento

## 🚨 Consideraciones de Seguridad

1. **Seguridad del Navegador**: Depende de la implementación de Web Crypto API del navegador
2. **Almacenamiento Local**: Claves de conversación almacenadas en localStorage del navegador (considerar IndexedDB para producción)
3. **Respaldo de Claves**: No hay mecanismo automático de respaldo de claves (los usuarios deben respaldar manualmente)
4. **Confianza del Servidor**: El servidor maneja la distribución de paquetes de claves pero nunca ve claves privadas
