import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { I18nProvider } from './i18n';
import { CatalogProvider } from './catalog/CatalogContext';
import { CatalogLayout } from './catalog/CatalogLayout';
import { Home } from './catalog/Home';
import { Browse } from './catalog/Browse';
import { ProductPage } from './catalog/ProductPage';
import { AdminRoot } from './admin/AdminLayout';
import { Products } from './admin/Products';
import { ProductForm } from './admin/ProductForm';
import { Brands } from './admin/Brands';
import { Categories } from './admin/Categories';
import { Settings } from './admin/Settings';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminRoot />}>
            <Route index element={<Products />} />
            <Route path="product/new" element={<ProductForm key="new" />} />
            <Route path="product/:id" element={<ProductForm />} />
            <Route path="brands" element={<Brands />} />
            <Route path="categories" element={<Categories />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route element={<CatalogProvider><CatalogLayout /></CatalogProvider>}>
            <Route index element={<Home />} />
            <Route path="browse" element={<Browse />} />
            <Route path="brand/:brandId" element={<Browse />} />
            <Route path="product/:id" element={<ProductPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
