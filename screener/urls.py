from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('api/data', views.get_market_data, name='market_data'),
    path('api/refresh', views.refresh_data, name='refresh_data'),
    path('api/refresh-status', views.refresh_status, name='refresh_status'),
    path('api/refresh-reset', views.refresh_reset, name='refresh_reset'),
    path('api/live-data', views.get_live_data, name='live_data'),
    path('api/live-refresh', views.live_refresh, name='live_refresh'),
    path('api/live-status', views.live_status, name='live_status'),
    path('api/chart/<str:symbol>', views.chart_proxy, name='chart_proxy'),
    path('api/export-csv', views.export_csv, name='export_csv'),
    # SPA catch-all fallback
    re_path(r'^.*$', views.dashboard, name='fallback'),
]
