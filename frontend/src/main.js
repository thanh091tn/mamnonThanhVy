import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import router from './router'
import './assets/css/nucleo-icons.css'
import './assets/css/nucleo-svg.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import ArgonDashboard from './argon-dashboard'
import './style.css'
import './assets/css/panel-tables.css'

const app = createApp(App)
app.use(store)
app.use(router)
app.use(ArgonDashboard)
app.mount('#app')
