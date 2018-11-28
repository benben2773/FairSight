from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import JsonResponse, HttpRequest
from rest_framework.request import Request
from . import models
from django.http import HttpResponse
from django.core.files import File
from django.core.serializers.json import DjangoJSONEncoder
from decimal import Decimal
import os
from config.settings.base import STATIC_ROOT, ROOT_DIR, STATICFILES_DIRS
from decorator import decorator

from ..static.lib.rankSVM import RankSVM
from ..static.lib.gower_distance import gower_distances
from io import StringIO
import csv
import pandas as pd
from pandas.io.json import json_normalize
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import pairwise_distances
from sklearn.manifold import MDS
from sklearn.preprocessing import Imputer
from sklearn.linear_model import LogisticRegression
from sklearn import preprocessing
from sklearn import svm

import pickle, random

# For ACF
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import roc_auc_score
from sklearn.base import clone
from themis_ml.postprocessing.reject_option_classification import SingleROClassifier
from themis_ml.linear_model import LinearACFClassifier
from themis_ml.metrics import mean_difference

import numpy as np
import statsmodels.api as sm
from scipy import stats
import math

import json, simplejson

simple_file_path = './data/themis_ml_toy.csv'
sample_file_path = './data/german_data_sample.csv'
heavy_file_path = './data/german_data.csv'

numerical_features = ['age_in_years', 'duration_in_month', 'credit_amount',	'savings', 'installment_as_income_perc',
                    'present_residence_since',	'number_of_existing_credits_at_this_bank',	'marriage',
                    'other_debtors', 'status_of_existing_checking_account',	'property',
                    'other_installment_plans', 'housing']

category_ranges = {
    'age>25': ['age_over_25', 'age_less_25'],
    'age>35': ['age_over_25', 'age_less_25']
}

METRICS_COLUMNS_THEMIS_ML = [
    'mean_diff_sex', 'auc_sex']

def open_dataset(file_path):
    entire_file_path = os.path.join(STATICFILES_DIRS[0], file_path)
    whole_dataset_df = pd.read_csv(open(entire_file_path, 'rU'))
    whole_dataset_df.set_index('idx')

    return whole_dataset_df

def get_selected_dataset(whole_dataset_df, selected_x, selected_y, selected_sensitive_attr):
    selected_x_df = whole_dataset_df[selected_x]
    selected_y_col = whole_dataset_df[selected_y]
    selected_sensitive_attr_col = whole_dataset_df[selected_sensitive_attr]
    idx_col = whole_dataset_df['idx']
    dataset_df = pd.concat([selected_x_df, selected_y_col, selected_sensitive_attr_col, idx_col], axis=1)

    return dataset_df

def do_encoding_categorical_vars(whole_dataset_df):
    dataset_df = whole_dataset_df.copy()

    for feature in dataset_df:
        if feature not in numerical_features:
            dataset_df[feature] = pd.Categorical(dataset_df[feature])
            categories = dataset_df[feature].cat.categories
            dataset_df[feature] = dataset_df[feature].cat.codes

    return dataset_df

def save_trained_model(ranking_instance, model):
    for file_num in range(1, 15):
        filename = './app/static/data/trained_model_' + str(ranking_instance['rankingId'])
        filename = filename + '_' + str(file_num) + '.pkl'
        with open(filename, 'wb') as f:
            pickle.dump(model, f)
        

def load_trained_model(ranking_instance):
    for file_num in range(1, 15):
        filename = './app/static/data/trained_model_' + str(ranking_instance['rankingId'])
        filename = filename + '_' + str(file_num) + '.pkl'
        model = ''
        
        if os.path.exists(filename):
            try:
                print('openn: ', filename)
                f = open(filename, 'rb')
                if os.path.exists(filename):    # Since it's asynchronous
                    try:
                        unpickler = pickle.Unpickler(f)
                        model = unpickler.load()
                        f.close()
                        os.remove(filename)
                    except FileNotFoundError as e:
                        pass
                    except EOFError as e2:
                        pass

            except FileNotFoundError as e:
                continue
        
            if model != '':
                return model
            else:
                continue

def run_experiment_iteration_themis_ml_ACF(
        X, X_no_sex, y, s_sex, train, test):
    '''Run the experiment on a particular set of train and test indices.'''
    
    # store our metrics here. This will be a list of lists, where the inner
    # list is contains the following metadata:
    # - 'name'
    # - fairness metric with respect to sex
    # - fairness metric with respect to foreign status
    # - utility metric with respect to sex
    # - utility metric with respect to foreign status
    metrics = []

    # define our model.
    logistic_clf = LogisticRegression(penalty='l2', C=0.001, class_weight='balanced')
    baseline_clf = logistic_clf
    rpa_clf = logistic_clf
    roc_clf = SingleROClassifier(estimator=logistic_clf)
    acf_clf = LinearACFClassifier(
        target_estimator=logistic_clf,
        binary_residual_type='absolute')

    # train baseline model
    baseline_clf.fit(X[train], y[train])
    baseline_preds = baseline_clf.predict(X[test])
    baseline_auc = roc_auc_score(y[test], baseline_preds)
    metrics.append([
        'B',
        mean_difference(baseline_preds, s_sex[test])[0],
        baseline_auc
    ])

    # train 'remove protected attributes' model. Here we have to train two
    # seperate ones for sex and foreign status.

    # model trained with no explicitly sex-related variables
    rpa_preds_no_sex = rpa_clf.fit(
        X_no_sex[train], y[train]).predict(X_no_sex[test])
    metrics.append([
        'RPA',
        mean_difference(rpa_preds_no_sex, s_sex[test])[0],
        roc_auc_score(y[test], rpa_preds_no_sex)
    ])

    # train reject-option classification model.
    roc_clf.fit(X[train], y[train])
    roc_preds_sex = roc_clf.predict(X[test], s_sex[test])
    metrics.append([
        'ROC',
        mean_difference(roc_preds_sex, s_sex[test])[0],
        roc_auc_score(y[test], roc_preds_sex)
    ])

    # train additive counterfactually fair model.
    acf_preds_sex = acf_clf.fit(
        X[train], y[train], s_sex[train]).predict(X[test], s_sex[test])
    metrics.append([
        'ACF',
        mean_difference(acf_preds_sex, s_sex[test])[0],
        roc_auc_score(y[test], acf_preds_sex)
    ])

    probs = acf_clf.predict_proba(X, s_sex)
    accuracy = roc_auc_score(y[test], acf_preds_sex)
    probs_would_not_default = [ prob[1] for prob in probs ]

    print('probs: ')
    print(probs_would_not_default)
    # convert metrics list of lists into dataframe
    return { 'prob': probs_would_not_default, 'accuracy': accuracy, 'acf_fit': acf_clf }

def perturb_feature(ranking_instance):
    perturbed_feature = ranking_instance['perturbedFeature']
    perturbed_feature_info = [ feature for feature in ranking_instance['features'] if feature['name'] == perturbed_feature ][0]
    instances = ranking_instance['instances']

    # print('perturbed_feature: ', perturbed_feature)
    # print('instancessss: ', [ instance['features'][perturbed_feature] for instance in instances ])
    # Shuffle the values (permutation)
    permuted_feature_values = random.sample([ instance['features'][perturbed_feature] for instance in instances ], len(instances))

    for idx, instance in enumerate(instances):
        instance['features'][perturbed_feature] = permuted_feature_values[idx]

    return pd.DataFrame([ instance['features'] for instance in instances ])

class LoadFile(APIView):
    def get(self, request, format=None):
        whole_dataset_df = open_dataset(sample_file_path)

        return Response(whole_dataset_df.to_json(orient='index'))

class ExtractFeatures(APIView):
    def get(self, request, format=None):
        whole_dataset_df = open_dataset(sample_file_path)
        dataset_df = whole_dataset_df.copy()
        dataset_df = dataset_df.drop('idx', axis=1)
        feature_info_list = []

        for feature in dataset_df:
            feature_info = {}
            if feature not in numerical_features:
                dataset_df[feature] = pd.Categorical(dataset_df[feature])
                categories = dataset_df[feature].cat.categories
                dataset_df[feature] = dataset_df[feature].cat.codes
                feature_info = { 'name': feature, 'type': 'categorical', 'range': list(categories) }
            else:
                min_value = float(np.amin(dataset_df[feature]))
                max_value = float(np.amax(dataset_df[feature]))
                mean_value = float(np.mean(dataset_df[feature]))
                std_value = float(math.sqrt(np.mean(dataset_df[feature])))
                feature_info = { 'name': feature, 'type': 'continuous', 'mean': mean_value, 'std': std_value, 'range': [min_value, max_value] }
            
            feature_info_list.append(feature_info)

        return Response(json.dumps(feature_info_list))

class RunRankSVM(APIView):
    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))
        
        features = [ feature['name'] for feature in json_request['features'] ]
        target = json_request['target']['name']
        sensitive_attr = json_request['sensitiveAttr']['name']
        method = json_request['method']['name']

        # features = ['credit_amount', 'installment_rate_in_percentage_of_disposable_income', 'age_in_years']
        # target = 'credit_risk'
        # sensitive_attr = 'sex'
        # method = 'RankSVM'

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        X = whole_dataset_df[features]
        X_wo_s_attr = whole_dataset_df[features]
        y = whole_dataset_df[target]
        s = whole_dataset_df[sensitive_attr] # male:0, female: 1

        X_train, X_test, y_train, y_test = train_test_split(X.as_matrix(), y.as_matrix(), test_size=0.3, random_state=42, shuffle=False)
        rank_svm = RankSVM().fit(X_train, y_train)
        accuracy = rank_svm.score(X_test, y_test)

        output_df = X.copy()
        output_df['idx'] = whole_dataset_df['idx']
        output_df['group'] = s
        output_df['target'] = y

        weighted_X_df = X.copy()
        for idx, feature in enumerate(X.columns):
            weighted_X_df[feature] = X[feature] * rank_svm.coef_[0, idx]
        output_df['weighted_sum'] = weighted_X_df.sum(axis=1)

        # When we put the leader as 100, what's the weight, and what's the scores for the rest of them when being multiplied by the weight?
        weight_from_leader = 100 / output_df['weighted_sum'].max()
        min_max_scaler = preprocessing.MinMaxScaler()
        scaled_sum = min_max_scaler.fit_transform(output_df['weighted_sum'].values.reshape(-1, 1))
        output_df['score'] = scaled_sum * 100

        # Add rankings
        output_df = output_df.sort_values(by='score', ascending=False)
        output_df['ranking'] = range(1, len(output_df) + 1)

        # Convert to dict and put all features into 'features' key
        instances_dict_list = list(output_df.T.to_dict().values())
        for output_item in instances_dict_list:  # Go over all items
            features_dict = {}
            for feature_key in features:
                features_dict[ feature_key ] = output_item[ feature_key ]
                output_item.pop(feature_key, None)
            output_item['features'] = features_dict

        # !!!! json_request['rankingId']
        ranking_instance_dict = {
            'rankingId': json_request['rankingId'],
            'features': json_request['features'],
            'target': json_request['target'],
            'sensitiveAttr': json_request['sensitiveAttr'],
            'method': json_request['method'],
            'stat': { 'accuracy': math.ceil(accuracy * 100) },
            'instances': instances_dict_list
        }

        save_trained_model(ranking_instance_dict, rank_svm)

        return Response(json.dumps(ranking_instance_dict))

class RunSVM(APIView):

    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        print('here in runsvm')
        json_request = json.loads(request.body.decode(encoding='UTF-8'))

        features = [ feature['name'] for feature in json_request['features'] ]
        target = json_request['target']['name']
        sensitive_attr = json_request['sensitiveAttr']['name']
        method = json_request['method']['name']

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        X = whole_dataset_df[features]
        X_wo_s_attr = whole_dataset_df[features]
        y = whole_dataset_df[target]
        s = whole_dataset_df[sensitive_attr] # male:0, female: 1

        X_train, X_test, y_train, y_test = train_test_split(X.as_matrix(), y.as_matrix(), test_size=0.3)
        svm_fit = svm.SVC(kernel='linear', random_state=0, cache_size=7000, probability=True).fit(X_train, y_train)
        accuracy = svm_fit.score(X_test, y_test)
        probs = svm_fit.predict_proba(X)
        probs_would_not_default = [ prob[0] for prob in probs ]

        output_df = X.copy()
        output_df['idx'] = whole_dataset_df['idx']
        output_df['group'] = s
        output_df['target'] = y

        # Add rankings
        output_df['prob'] = probs_would_not_default
        output_df = output_df.sort_values(by='prob', ascending=False)
        output_df['ranking'] = range(1, len(output_df) + 1)

        # Convert to dict and put all features into 'features' key
        instances_dict_list = list(output_df.T.to_dict().values())
        for output_item in instances_dict_list:  # Go over all items
            features_dict = {}
            for feature_key in features:
                features_dict[ feature_key ] = output_item[ feature_key ]
                output_item.pop(feature_key, None)
            output_item['features'] = features_dict

        ranking_instance_dict = {
            'rankingId': json_request['rankingId'],
            'features': json_request['features'],
            'target': json_request['target'],
            'sensitiveAttr': json_request['sensitiveAttr'],
            'method': json_request['method'],
            'stat': { 'accuracy': math.ceil(accuracy * 100) },
            'instances': instances_dict_list
        }

        save_trained_model(ranking_instance_dict, svm_fit)

        return Response(json.dumps(ranking_instance_dict))

class RunLR(APIView):

    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        ranking_instance = json.loads(request.body.decode(encoding='UTF-8'))

        features = [ feature['name'] for feature in ranking_instance['features'] ]
        target = ranking_instance['target']['name']
        sensitive_attr = ranking_instance['sensitiveAttr']['name']
        method = ranking_instance['method']['name']
        is_for_perturbation = ranking_instance['isForPerturbation']

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        if is_for_perturbation == False:
            X = whole_dataset_df[features]
        elif is_for_perturbation == True:
            # # Update features in the instances (Sort by idx both and biject instance in the dataset to ranking instance one by one)
            # ranking_instance['instances'] = sorted(ranking_instance['instances'], key=lambda d: d['idx'])
            # filtered_instances = whole_dataset_df.sort_values(by=['idx'])[features]
            # for idx, instance in enumerate(ranking_instance['instances']):
            #     instance['features'] = filtered_instances.loc[idx]
            X = perturb_feature(ranking_instance)

        X_wo_s_attr = whole_dataset_df[features]
        y = whole_dataset_df[target]
        s = whole_dataset_df[sensitive_attr] # male:0, female: 1

        X_train, X_test, y_train, y_test = train_test_split(X.as_matrix(), y.as_matrix(), test_size=0.3, random_state=42, shuffle=True)
        if is_for_perturbation == False:
            lr_fit = LogisticRegression(random_state=0).fit(X_train, y_train)
            accuracy = lr_fit.score(X_test, y_test)
        elif is_for_perturbation == True:
            print('ranking_instanccc:', ranking_instance)
            lr_fit = load_trained_model(ranking_instance)
            accuracy_after_perturbation = lr_fit.score(X_test, y_test)

        probs = lr_fit.predict_proba(X)
        probs_would_not_default = [ prob[1] for prob in probs ]

        output_df = X.copy()
        output_df['idx'] = whole_dataset_df['idx']
        output_df['group'] = s
        output_df['target'] = y

        if is_for_perturbation == True:
            instances_df = pd.DataFrame(ranking_instance['instances']).sort_values(by='idx', ascending=True)
            instances = ranking_instance['instances']
            previous_ranking_df = pd.DataFrame({'previousRanking': instances_df['ranking'], \
                                                'idx': instances_df['idx']})
            previous_ranking_df.set_index('idx')
            output_df = pd.merge(output_df, previous_ranking_df, on=['idx'])

        # Add rankings
        output_df['prob'] = probs_would_not_default
        output_df = output_df.sort_values(by='prob', ascending=False)
        output_df['ranking'] = range(1, len(output_df) + 1)

        # Convert to dict and put all features into 'features' key
        instances_dict_list = list(output_df.T.to_dict().values())
        for output_item in instances_dict_list:  # Go over all items
            features_dict = {}
            for feature_key in features:
                features_dict[ feature_key ] = output_item[ feature_key ]
                output_item.pop(feature_key, None)
            output_item['features'] = features_dict

        if is_for_perturbation == True:
            ranking_instance['statForPerturbation']['accuracy'] = math.ceil(accuracy_after_perturbation * 100)    
        else:
            ranking_instance['stat']['accuracy'] = math.ceil(accuracy * 100)
        ranking_instance['instances'] = instances_dict_list

        save_trained_model(ranking_instance, lr_fit)

        return Response(json.dumps(ranking_instance))

# Run Additive Counterfactual Fairness (ACF) algorithm using themis-ml library
class RunACF(APIView):
    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))

        features = [ feature['name'] for feature in json_request['features'] ]
        target = json_request['target']['name']
        sensitive_attr = json_request['sensitiveAttr']['name']
        method = json_request['method']['name']

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        X = whole_dataset_df[features]
        X_wo_s_attr = whole_dataset_df[features]
        y = whole_dataset_df[target]
        s = whole_dataset_df[sensitive_attr] # male:0, female: 1

        N_SPLITS = 5
        N_REPEATS = 20
        cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=41)

        probs_df = pd.DataFrame()
        for i, (train_idx, test_idx) in enumerate(cv.split(X.values, y.values, groups=s.values)):
            if i == 0:
                result_dict = run_experiment_iteration_themis_ml_ACF(
                    X.values, X_wo_s_attr.values, y.values, s.values, train_idx, test_idx)
    
        output_df = X.copy()
        output_df['idx'] = whole_dataset_df['idx']
        output_df['group'] = s
        output_df['target'] = y

        # Add rankings
        acf_fit = result_dict['acf_fit']
        output_df['prob'] = result_dict['prob']
        output_df = output_df.sort_values(by='prob', ascending=False)
        output_df['ranking'] = range(1, len(output_df) + 1)
        accuracy = result_dict['accuracy']

        # Convert to dict and put all features into 'features' key
        instances_dict_list = list(output_df.T.to_dict().values())
        for output_item in instances_dict_list:  # Go over all items
            features_dict = {}
            for feature_key in features:
                features_dict[ feature_key ] = output_item[ feature_key ]
                output_item.pop(feature_key, None)
            output_item['features'] = features_dict

        ranking_instance_dict = {
            'rankingId': json_request['rankingId'],
            'features': json_request['features'],
            'target': json_request['target'],
            'sensitiveAttr': json_request['sensitiveAttr'],
            'method': json_request['method'],
            'stat': { 'accuracy': math.ceil(accuracy * 100) },
            'instances': instances_dict_list
        }

        save_trained_model(ranking_instance_dict, acf_fit)

        return Response(json.dumps(ranking_instance_dict))
                

class RunLRA(APIView):

    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))

        features = json_request['features']
        target = json_request['target']
        sensitive_attr = json_request['sensitiveAttr']
        method = json_request['method']['name']

        feature_names = [ feature['name'] for feature in features ]
        target_name = target['name']
        sensitive_attr_name = sensitive_attr['name']

        whole_dataset_df = open_dataset(sample_file_path)
        dataset_df = do_encoding_categorical_vars(whole_dataset_df)
        dataset_df = get_selected_dataset(dataset_df, feature_names, target_name, sensitive_attr_name)
        dataset_df = dataset_df.sort_values(by='idx', ascending=True)

        X = dataset_df[ feature_names ]
        y = dataset_df[ target_name ]
        idx_col = dataset_df['idx']

        X_train, X_test, y_train, y_test = train_test_split(X.as_matrix(), y.as_matrix(), test_size=0.3)
        lr_fit = LogisticRegression(random_state=0).fit(X_train, y_train)
        accuracy = lr_fit.score(X_test, y_test)
        pred_probs = lr_fit.predict_proba(X)
        print('probs of lr: ')
        print(pred_probs)

        output_df = X.copy()
        output_df['idx'] = idx_col
        output_df['group'] = dataset_df[ sensitive_attr_name ]
        output_df['target'] = y

        weighted_X_df = X.copy()
        for idx, feature in enumerate(X.columns):
            weighted_X_df[feature] = X[feature] * lr_fit.coef_[0, idx]
        output_df['weighted_sum'] = weighted_X_df.sum(axis=1)

        # When we put the leader as 100, what's the weight, and what's the scores for the rest of them when being multiplied by the weight?
        weight_from_leader = 100 / output_df['weighted_sum'].max()
        min_max_scaler = preprocessing.MinMaxScaler()
        scaled_sum = min_max_scaler.fit_transform(output_df['weighted_sum'].values.reshape(-1, 1))
        output_df['score'] = scaled_sum * 100
        # output_df['score'] = [ prob[0]*100 for prob in pred_probs ]

        # Add rankings
        output_df = output_df.sort_values(by='score', ascending=False)
        output_df['ranking'] = range(1, len(output_df) + 1)

        # Convert to dict and put all features into 'features' key
        instances_dict_list = list(output_df.T.to_dict().values())
        for output_item in instances_dict_list:  # Go over all items
            features_dict = {}
            for feature_key in feature_names:
                features_dict[ feature_key ] = output_item[ feature_key ]
                output_item.pop(feature_key, None)
            output_item['features'] = features_dict

        ranking_instance_dict = {
            'rankingId': json_request['rankingId'],
            'features': json_request['features'],
            'target': json_request['target'],
            'sensitiveAttr': json_request['sensitiveAttr'],
            'method': json_request['method'],
            'stat': { 'accuracy': math.ceil(accuracy * 100) },
            'instances': instances_dict_list
        }

        return Response(json.dumps(ranking_instance_dict))

class SetSensitiveAttr(APIView):

    def post(self, request, format=None):
        sensitiveAttr = self.request.body


class RunMDS(APIView):
    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))
        features = [ feature['name'] for feature in json_request['features'] ]
        target = json_request['target']['name']
        sensitive_attr = json_request['sensitiveAttr']['name']

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        X = whole_dataset_df[features]
        X_wo_s_attr = whole_dataset_df[features]
        y = whole_dataset_df[target]
        s = whole_dataset_df[sensitive_attr] # male:0, female: 1

        d = pairwise_distances(X)

        df_mds_result = pd.DataFrame(MDS(n_components=2, metric=False, random_state=3).fit_transform(d), X.index)
        df_mds_result['idx'] = whole_dataset_df['idx']
        df_mds_result['group'] = s
        df_mds_result['target'] = y
        df_mds_result.columns = ['dim1', 'dim2', 'idx', 'group', 'target']

        return Response(df_mds_result.to_json(orient='index'))

# Calculate pairwise gower distance for mixed type of variables
class CalculatePairwiseInputDistance(APIView):
    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))
        features = [ feature['name'] for feature in json_request['features'] ]
        target = json_request['target']['name']
        sensitive_attr = json_request['sensitiveAttr']['name']

        raw_df = open_dataset('./data/themis_ml_raw_sample.csv')
        whole_dataset_df = open_dataset(sample_file_path)

        X = whole_dataset_df[features]
        # dataset_gower_distance = dataset_gower_distance.set_index(dataset_df['idx'])

        for feature in features:
            X[ feature ] = X[ feature ].astype(float)
        
        is_categorical_feature_list = []
        for feature in features:
            if feature in numerical_features:
                is_categorical_feature_list.append(False)
            else:
                is_categorical_feature_list.append(True)

        print(features)
        print(is_categorical_feature_list)
        pairwise_distances = gower_distances(X, categorical_features=is_categorical_feature_list)

        # Convert 2d array to a list of pairwise dictionaries
        # Index starting from 1
        pairwise_distances_list = []
        permutation_distances_list = []
        for i in range(pairwise_distances.shape[0]):
            for j in range(pairwise_distances.shape[1]):
                permutation_distances_list.append({
                        'idx1': i+1,
                        'idx2': j+1,
                        'input_dist': np.asscalar(pairwise_distances[i][j])
                    })

                if(i < j):  # Gather combinations (not permutations)
                    pairwise_distances_list.append({
                        'idx1': i+1,
                        'idx2': j+1,
                        'input_dist': np.asscalar(pairwise_distances[i][j])
                    })
        
        # Rank input distance and save it
        # pairwise_distances_list

        json_combined = simplejson.dumps({
                'pairwiseDistances': pairwise_distances_list, 
                'permutationDistances': permutation_distances_list
            })

        return Response(json_combined)

class TestCorrelationBtnSensitiveAndFeatures(APIView):
    
    def get(self, request, format=None):
        pass

# To calculate the similarity of two groups with different length: 
# (1) Protected vs. Non-protected group conditional to a feature (in Generator)
# (2) Outliers vs. Whole instances
class CalculateAndersonDarlingTest(APIView):

    def get(self, request, format=None):
        pass

    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))
        features = json_request['wholeFeatures']
        group_instances1 = json_request['groupInstances1']
        group_instances2 = json_request['groupInstances2']

        print('featuresss: ', features)
        
        test_result = {}
        for feature in features:
            feature_values_group1 = [ instance[feature] for instance in group_instances1 ]
            feature_values_group2 = [ instance[feature] for instance in group_instances2 ]

            wass_dist = stats.wasserstein_distance(feature_values_group1, feature_values_group2)
            print('andersonnn: ', feature, wass_dist)
            test_result[feature] = math.sqrt(wass_dist)

        return Response(json.dumps(test_result))

# Get the confidence interval of slope to measure the fair area
class CalculateConfidenceInterval(APIView):

    def get(self, request, format=None):
        pass
    
    def post(self, request, format=None):
        json_request = json.loads(request.body.decode(encoding='UTF-8'))

        reg_df = json_normalize(json_request)
        idx1 = reg_df['idx1']
        idx2 = reg_df['idx2']
        X = reg_df['X']
        y = reg_df['y']
        y_hat = reg_df['yHat']

        y_err = y - y_hat
        mean_x = X.mean()
        n = len(X)
        dof = n - 1
        t = stats.t.ppf(1-0.025, df=dof)
        s_err = np.sum(np.power(y_err, 2))

        conf_interval = t * np.sqrt((s_err/(n-2))*(1.0/n + (np.power((X-mean_x),2) / ((np.sum(np.power(X,2))) - n*(np.power(mean_x,2))))))
        upper = y_hat + 2*abs(conf_interval)
        lower = y_hat - 2*abs(conf_interval)
        isFair = np.zeros(reg_df.shape[0]) # 0: false (unfair), 1: true (fair)
        isUpper = np.ones(reg_df.shape[0])
        isLower = np.zeros(reg_df.shape[0])

        conf_interval_points_upper_lower_df = pd.DataFrame({ 'x': X, 'upper': upper, 'lower': lower, 'idx1': idx1, 'idx2': idx2, 'distortion': y, 'isFair': isFair })
        for idx, pair in conf_interval_points_upper_lower_df.iterrows():
            if (pair['distortion'] <= pair['upper']) and (pair['distortion'] >= pair['lower']):
                conf_interval_points_upper_lower_df.loc[idx, 'isFair'] = 1

        conf_interval_points_upper_df = pd.DataFrame({ 'x': X, 'y': upper, 'isUpper': isUpper, 'idx1': idx1, 'idx2': idx2, 'distortion': y, 'isFair': conf_interval_points_upper_lower_df['isFair'] })
        conf_interval_points_upper_df = conf_interval_points_upper_df.sort_values(by='x', ascending=True)
        conf_interval_points_lower_df = pd.DataFrame({ 'x': X, 'y': lower, 'isUpper': isLower, 'idx1': idx1, 'idx2': idx2, 'distortion': y, 'isFair': conf_interval_points_upper_lower_df['isFair'] })
        conf_interval_points_lower_df = conf_interval_points_lower_df.sort_values(by='x', ascending=True)
        conf_interval_points_df = pd.concat([conf_interval_points_upper_df, conf_interval_points_lower_df], axis=0)
        conf_interval_points_df = conf_interval_points_df.sort_values(by=['idx1', 'idx2'])

        return Response(conf_interval_points_df.to_json(orient='records'))