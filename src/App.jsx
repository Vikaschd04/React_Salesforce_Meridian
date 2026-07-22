import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AccountLayout from './pages/account/AccountLayout.jsx'
import Profile from './pages/account/Profile.jsx'
import Orders from './pages/account/Orders.jsx'
import OrderDetail from './pages/account/OrderDetail.jsx'
import Company from './pages/account/Company.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      {/* key on pathname re-mounts the page wrapper so the CSS enter
          animation plays on every route change (reduced-motion collapses it) */}
      <main id="main" className="app-main page-enter" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation/:orderId" element={<Confirmation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<Profile />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="company" element={<Company />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
