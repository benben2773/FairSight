from django.conf.urls import url
from . import views

urlpatterns = [
    url(
        regex=r'^file/$',
        view=views.LoadFile.as_view(),
        name='file'
    ),
    url(
        regex=r'^runModel/$',
        view=views.RunModel.as_view(),
        name='model'
    ),
    url(
        regex=r'^runMDS/$',
        view=views.RunMDS.as_view(),
        name='mds'
    ),
    url(
        regex=r'^getWeight/$',
        view=views.GetWeight.as_view(),
        name='weight'
    ),
    url(
        regex=r'^getWeightedDataset/$',
        view=views.GetWeightedDataset.as_view(),
        name='weight'
    ),
    url(
        regex=r'^getSelectedFeatureDataset/$',
        view=views.GetSelectedFeatureDataset.as_view(),
        name='selectedFeatures'
    ),
    url(
        regex=r'^setSensitiveAttr/$',
        view=views.SetSensitiveAttr.as_view(),
        name='sensitiveAttr'
    )
]