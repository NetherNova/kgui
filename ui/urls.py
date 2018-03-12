from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^start_experiment/', views.start_experiment, name='start_experiment'),
    url(r'^embedding/', views.embedding, name='embedding'),
    url(r'^status/', views.status, name='status'),
]