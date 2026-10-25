import { Link, Navigate, Route, Routes } from 'react-router-dom';
import {
  AdminCustomers,
  AdminDealers,
  AdminNotifications,
  AdminOrders,
  AdminProducts,
  AdminService,
  AdminShell,
  Overview,
} from './admin/Admin';
import { Guard, Layout } from './components/Layout';
import { Empty } from './components/ui';
import { DealerAccount, DealerDashboard, DealerShell } from './dealer/Dealer';
import { Login, Register, Reset } from './pages/Auth';
import Cart from './pages/Cart';
import Catalog from './pages/Catalog';
import Checkout from './pages/Checkout';
import Home from './pages/Home';
import Notifications from './pages/Notifications';
import { MyOrders, OrderDetail } from './pages/Orders';
import Product from './pages/Product';
import Profile from './pages/Profile';
import Service from './pages/Service';

export default function App() {
  return (
    <Routes>
      {/* Dedicated Admin Application Shell (no customer shopping nav mixed in) */}
      <Route path="admin/login" element={<Navigate to="/login" replace />} />
      <Route
        path="admin"
        element={
          <Guard roles={['admin']} to="/login">
            <AdminShell />
          </Guard>
        }
      >
        <Route index element={<Overview />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="dealers" element={<AdminDealers />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="service" element={<AdminService />} />
        <Route path="notifications" element={<AdminNotifications />} />
      </Route>

      {/* Dedicated Dealer B2B Workspace Shell */}
      <Route path="dealer" element={<DealerShell />}>
        <Route path="login" element={<Navigate to="/login" replace />} />
        <Route
          index
          element={
            <Guard roles={['dealer']} to="/login">
              <DealerDashboard />
            </Guard>
          }
        />
        <Route
          path="catalog"
          element={
            <Guard roles={['dealer']} to="/login">
              <Catalog wholesale />
            </Guard>
          }
        />
        <Route
          path="cart"
          element={
            <Guard roles={['dealer']} to="/login">
              <Cart />
            </Guard>
          }
        />
        <Route
          path="orders"
          element={
            <Guard roles={['dealer']} to="/login">
              <MyOrders dealer />
            </Guard>
          }
        />
        <Route
          path="account"
          element={
            <Guard roles={['dealer']} to="/login">
              <DealerAccount />
            </Guard>
          }
        />
      </Route>

      {/* Customer Storefront Shell */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="product/:sku" element={<Product />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="reset" element={<Reset />} />
        <Route
          path="checkout"
          element={
            <Guard>
              <Checkout />
            </Guard>
          }
        />
        <Route
          path="order-confirmation/:id"
          element={
            <Guard>
              <OrderDetail confirmation />
            </Guard>
          }
        />
        <Route
          path="orders"
          element={
            <Guard>
              <MyOrders />
            </Guard>
          }
        />
        <Route
          path="orders/:id"
          element={
            <Guard>
              <OrderDetail />
            </Guard>
          }
        />
        <Route path="service" element={<Service />} />
        <Route
          path="profile"
          element={
            <Guard>
              <Profile />
            </Guard>
          }
        />
        <Route
          path="notifications"
          element={
            <Guard>
              <Notifications />
            </Guard>
          }
        />
        <Route
          path="*"
          element={
            <div className="wrap" style={{ marginTop: 48 }}>
              <Empty
                title="Page not found (404)"
                action={
                  <div className="row" style={{ justifyContent: 'center' }}>
                    <Link className="btn" to="/">
                      Back to Homepage
                    </Link>
                    <Link className="btn ghost" to="/catalog">
                      Browse Catalog
                    </Link>
                  </div>
                }
              >
                The page or product route you requested could not be found. Check the URL or browse our active water purification catalog.
              </Empty>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
